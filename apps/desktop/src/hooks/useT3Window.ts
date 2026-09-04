import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import {
	focusT3Window,
	openT3Window,
	subscribeT3Window,
	t3WindowOpen,
} from "../lib/t3-window";

export function useT3Window() {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(() => {
		if (!isTauri()) {
			setOpen(false);
			return;
		}
		void t3WindowOpen().then(setOpen);
	}, []);

	useEffect(() => {
		refresh();
		return subscribeT3Window(refresh);
	}, [refresh]);

	const openUrl = useCallback(async (url: string) => {
		setBusy(true);
		try {
			setOpen(await openT3Window(url));
		} finally {
			setBusy(false);
		}
	}, []);

	const focus = useCallback(async () => {
		setOpen(await focusT3Window());
	}, []);

	return { open, busy, openUrl, focus };
}
