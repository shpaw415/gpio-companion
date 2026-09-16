import { POST as mintOfflineKey } from "@api/device/offline-key";
import { useEffect, useState } from "react";
import { unwrapAction } from "../lib/action.ts";
import {
	loadOfflineKey,
	type StoredOfflineKey,
	saveOfflineKey,
	shouldMintOfflineKey,
} from "../lib/offline-keys.ts";
import { useT } from "./useLocale.tsx";

export function useOfflineBleKey(uuid: string) {
	const t = useT();
	const [record, setRecord] = useState<StoredOfflineKey | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed) {
			setRecord(null);
			setError("");
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const existing = await loadOfflineKey(trimmed);
				if (cancelled) {
					return;
				}
				if (!shouldMintOfflineKey(existing)) {
					setRecord(existing);
					setError("");
					return;
				}
				const bundle = unwrapAction(await mintOfflineKey(trimmed));
				const next = { uuid: trimmed, ...bundle };
				await saveOfflineKey(next);
				if (!cancelled) {
					setRecord(next);
					setError("");
				}
			} catch (caught) {
				if (cancelled) {
					return;
				}
				const existing = await loadOfflineKey(trimmed).catch(() => null);
				setRecord(existing);
				if (!existing) {
					setError(
						caught instanceof Error ? caught.message : "offline key failed",
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [uuid]);

	const grant = record?.grant;
	const now = Date.now();
	const label = !grant
		? t("ble.offlineNotIssued")
		: grant.exp <= now
			? t("ble.offlineExpired")
			: t("ble.offlineLeft", {
					hours: Math.max(0, Math.floor((grant.exp - now) / 3_600_000)),
				});

	return {
		record,
		label,
		error,
	};
}
