import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useRef } from "react";
import { t3AppUrl, t3IframeSrc } from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";

const LABEL = "t3";

function waitCreated(view: WebviewWindow) {
	return new Promise<void>((resolve, reject) => {
		view.once("tauri://created", () => resolve());
		view.once("tauri://error", (event) => {
			reject(new Error(String(event.payload ?? "t3 window failed")));
		});
	});
}

export default function T3Frame({ visible }: { visible: boolean }) {
	const { uuid, pairToken } = useBoardSelection();
	const urlRef = useRef("");

	useEffect(() => {
		if (!isTauri()) {
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const home = t3AppUrl(uuid);
				const pair = t3IframeSrc(uuid, pairToken);
				const existing = await WebviewWindow.getByLabel(LABEL);
				if (!visible || !home) {
					await existing?.hide();
					return;
				}
				const want = pairToken ? pair : urlRef.current || home;
				if (existing && urlRef.current === want) {
					await existing.show();
					await existing.setFocus();
					return;
				}
				if (pairToken && existing && urlRef.current !== pair) {
					await existing.close().catch(() => undefined);
				} else if (existing && !pairToken) {
					await existing.show();
					await existing.setFocus();
					return;
				} else if (existing) {
					await existing.close().catch(() => undefined);
				}
				if (cancelled) {
					return;
				}
				const view = new WebviewWindow(LABEL, {
					url: want,
					title: "T3 Code",
					width: 1400,
					height: 900,
					focus: true,
					visible: true,
				});
				await waitCreated(view);
				if (cancelled) {
					await view.close().catch(() => undefined);
					return;
				}
				urlRef.current = want;
			} catch (caught) {
				console.error("gpio-companion-desktop t3 window", caught);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [uuid, pairToken, visible]);

	return null;
}
