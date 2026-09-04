import { isTauri } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWebview, Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { t3IframeSrc } from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";

const LABEL = "t3";
const CHROME = "[data-t3-chrome]";

function waitCreated(view: Webview) {
	return new Promise<void>((resolve, reject) => {
		view.once("tauri://created", () => resolve());
		view.once("tauri://error", (event) => {
			reject(new Error(String(event.payload ?? "t3 webview failed")));
		});
	});
}

async function windowLogicalSize() {
	const win = getCurrentWindow();
	const factor = await win.scaleFactor();
	const inner = await win.innerSize();
	return inner.toLogical(factor);
}

async function restoreMain() {
	const main = getCurrentWebview();
	const size = await windowLogicalSize();
	await main.setPosition(new LogicalPosition(0, 0));
	await main.setSize(new LogicalSize(size.width, size.height));
}

function chromeHeight() {
	const chrome = document.querySelector(CHROME);
	if (!chrome) {
		return 0;
	}
	return Math.ceil(chrome.getBoundingClientRect().bottom);
}

export default function T3Frame({ visible }: { visible: boolean }) {
	const { uuid, pairToken } = useBoardSelection();
	const viewRef = useRef<Webview | null>(null);
	const urlRef = useRef("");

	useEffect(() => {
		if (!isTauri()) {
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const target = t3IframeSrc(uuid, pairToken);
				if (!visible || !target) {
					await viewRef.current?.hide();
					await restoreMain();
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
				top = Math.max(top, 48);
				const size = await windowLogicalSize();
				const paneHeight = Math.max(80, size.height - top);
				const main = getCurrentWebview();
				await main.setPosition(new LogicalPosition(0, 0));
				await main.setSize(new LogicalSize(size.width, top));
				if (viewRef.current && urlRef.current === target) {
					await viewRef.current.setPosition(new LogicalPosition(0, top));
					await viewRef.current.setSize(
						new LogicalSize(size.width, paneHeight),
					);
					await viewRef.current.show();
					return;
				}
				if (viewRef.current && urlRef.current !== target && pairToken) {
					await viewRef.current.close().catch(() => undefined);
					viewRef.current = null;
					urlRef.current = "";
				} else if (viewRef.current && !pairToken) {
					await viewRef.current.setPosition(new LogicalPosition(0, top));
					await viewRef.current.setSize(
						new LogicalSize(size.width, paneHeight),
					);
					await viewRef.current.show();
					return;
				} else if (viewRef.current) {
					await viewRef.current.close().catch(() => undefined);
					viewRef.current = null;
					urlRef.current = "";
				}
				if (cancelled) {
					await restoreMain();
					return;
				}
				const view = new Webview(getCurrentWindow(), LABEL, {
					url: target,
					x: 0,
					y: top,
					width: size.width,
					height: paneHeight,
					focus: true,
					dragDropEnabled: false,
				});
				await waitCreated(view);
				if (cancelled) {
					await view.close().catch(() => undefined);
					await restoreMain();
					return;
				}
				viewRef.current = view;
				urlRef.current = target;
			} catch (caught) {
				console.error("gpio-companion-desktop t3 pane", caught);
				await restoreMain().catch(() => undefined);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [uuid, pairToken, visible]);

	useEffect(() => {
		if (!isTauri()) {
			return;
		}
		const win = getCurrentWindow();
		let unlisten: (() => void) | undefined;
		void win.onResized(() => {
			if (!visible) {
				return;
			}
			void (async () => {
				const top = Math.max(chromeHeight(), 48);
				const size = await windowLogicalSize();
				const paneHeight = Math.max(80, size.height - top);
				const main = getCurrentWebview();
				await main.setPosition(new LogicalPosition(0, 0));
				await main.setSize(new LogicalSize(size.width, top));
				if (viewRef.current) {
					await viewRef.current.setPosition(new LogicalPosition(0, top));
					await viewRef.current.setSize(
						new LogicalSize(size.width, paneHeight),
					);
				}
			})();
		}).then((fn) => {
			unlisten = fn;
		});
		return () => {
			unlisten?.();
			void restoreMain().catch(() => undefined);
			void viewRef.current?.hide();
		};
	}, [visible]);

	return null;
}

export const T3_FRAME_SLOT_ID = "gpio-t3-frame-slot";
