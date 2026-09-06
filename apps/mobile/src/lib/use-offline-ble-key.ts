import { useEffect, useState } from "react";
import { ensureOfflineKey } from "./api.ts";
import { useAuth } from "./auth.tsx";
import { offlineKeyLabel, type StoredOfflineKey } from "./offline-keys.ts";

export function useOfflineBleKey(uuid: string) {
	const auth = useAuth();
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

	return { record, label: offlineKeyLabel(record) };
}
