import { useEffect, useState } from "react";
import { ensureOfflineKey } from "../api";
import {
	type OfflineGrantBundle,
	offlineKeyLabel,
} from "../offline-sign";

export function useOfflineBleKey(uuid: string) {
	const [record, setRecord] = useState<OfflineGrantBundle | null>(null);

	useEffect(() => {
		const trimmed = uuid.trim();
		if (!trimmed) {
			setRecord(null);
			return;
		}
		let cancelled = false;
		void ensureOfflineKey(trimmed).then((next) => {
			if (!cancelled) {
				setRecord(next);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [uuid]);

	return { record, label: offlineKeyLabel(record) };
}
