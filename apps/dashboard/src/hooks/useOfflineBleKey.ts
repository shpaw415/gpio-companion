import { POST as mintOfflineKey } from "@api/device/offline-key";
import { useEffect, useState } from "react";
import { unwrapAction } from "../lib/action.ts";
import {
	loadOfflineKey,
	offlineKeyLabel,
	type StoredOfflineKey,
	saveOfflineKey,
	shouldMintOfflineKey,
} from "../lib/offline-keys.ts";

export function useOfflineBleKey(uuid: string) {
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

	return {
		record,
		label: offlineKeyLabel(record?.grant),
		error,
	};
}
