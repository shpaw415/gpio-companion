import { useEffect, useMemo, useState } from "react";
import { ensureOfflineKey } from "./api.ts";
import { useAuth } from "./auth.tsx";
import { useT } from "./locale.tsx";
import { liveOfflineKey, type StoredOfflineKey } from "./offline-keys.ts";

export function useOfflineBleKey(uuid: string) {
	const auth = useAuth();
	const t = useT();
	const [record, setRecord] = useState<StoredOfflineKey | null>(null);

	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed || !auth.token) {
			setRecord(null);
			return;
		}
		let cancelled = false;
		void ensureOfflineKey(auth.token, trimmed).then((next) => {
			if (!cancelled) {
				setRecord(next);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [uuid, auth.token]);

	const label = useMemo(() => {
		if (!record) {
			return t("ble.offlineNotIssued");
		}
		if (!liveOfflineKey(record)) {
			return t("ble.offlineExpired");
		}
		const hours = Math.max(
			0,
			Math.floor((record.grant.exp - Date.now()) / 3_600_000),
		);
		return t("ble.offlineLeft", { hours });
	}, [record, t]);

	return { record, label };
}
