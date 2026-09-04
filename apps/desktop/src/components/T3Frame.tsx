import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { t3IframeSrc } from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";

const CHROME = "[data-t3-chrome]";

function chromeHeight() {
	const chrome = document.querySelector(CHROME);
	if (!chrome) {
		return 0;
	}
	return Math.ceil(chrome.getBoundingClientRect().bottom);
}

export default function T3Frame({ visible }: { visible: boolean }) {
	const { uuid, pairToken } = useBoardSelection();

	useEffect(() => {
		if (!isTauri()) {
			return;
		}
		let cancelled = false;
		void (async () => {
			const target = t3IframeSrc(uuid, pairToken);
			if (!visible || !target) {
				await invoke("t3_pane_hide").catch(() => undefined);
				return;
			}
			let top = chromeHeight();
			for (let i = 0; i < 20 && top < 40; i += 1) {
				await new Promise((resolve) => window.setTimeout(resolve, 50));
				top = chromeHeight();
			}
			if (cancelled) {
				return;
			}
			await invoke("t3_pane_show", {
				url: target,
				chromeH: top,
			});
		})().catch((caught) => {
			console.error("gpio-companion-desktop t3 pane", caught);
			void invoke("t3_pane_hide").catch(() => undefined);
		});
		return () => {
			cancelled = true;
		};
	}, [uuid, pairToken, visible]);

	useEffect(() => {
		return () => {
			if (isTauri()) {
				void invoke("t3_pane_hide").catch(() => undefined);
			}
		};
	}, []);

	return null;
}
