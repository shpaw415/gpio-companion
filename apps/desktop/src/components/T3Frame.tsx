import { isTauri } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { t3IframeSrc } from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";

const SLOT_ID = "gpio-t3-frame-slot";
const VIEW_LABEL = "t3";

export default function T3Frame({ visible }: { visible: boolean }) {
	const { uuid, pairToken } = useBoardSelection();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const assigned = useRef("");
	const viewRef = useRef<Webview | null>(null);
	const viewUrl = useRef("");
	const [native, setNative] = useState(false);
	const [rect, setRect] = useState({
		top: 0,
		left: 0,
		width: 0,
		height: 0,
	});
	const ready = rect.width >= 8 && rect.height >= 8;
	const target = t3IframeSrc(uuid, pairToken);

	useEffect(() => {
		setNative(isTauri());
	}, []);

	useEffect(() => {
		if (!uuid || !visible) {
			return;
		}
		let cancelled = false;
		let observer: ResizeObserver | null = null;
		let frame = 0;
		const sync = () => {
			const slot = document.getElementById(SLOT_ID);
			if (!slot) {
				setRect({ top: 0, left: 0, width: 0, height: 0 });
				return;
			}
			const next = slot.getBoundingClientRect();
			setRect({
				top: next.top,
				left: next.left,
				width: Math.max(next.width, window.innerWidth - next.left),
				height: Math.max(next.height, window.innerHeight - next.top),
			});
		};
		const wait = () => {
			if (cancelled) {
				return;
			}
			if (!document.getElementById(SLOT_ID)) {
				frame = window.requestAnimationFrame(wait);
				return;
			}
			sync();
			if (typeof ResizeObserver !== "undefined") {
				const slot = document.getElementById(SLOT_ID);
				if (slot) {
					observer = new ResizeObserver(sync);
					observer.observe(slot);
				}
			}
		};
		wait();
		window.addEventListener("resize", sync);
		return () => {
			cancelled = true;
			window.cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener("resize", sync);
		};
	}, [uuid, visible]);

	useEffect(() => {
		if (!native) {
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				if (!visible || !target || !ready) {
					await viewRef.current?.hide();
					return;
				}
				if (viewRef.current && viewUrl.current === target) {
					return;
				}
				if (viewRef.current) {
					await viewRef.current.close().catch(() => undefined);
					viewRef.current = null;
					viewUrl.current = "";
				}
				if (cancelled) {
					return;
				}
				const win = getCurrentWindow();
				const view = new Webview(win, VIEW_LABEL, {
					url: target,
					x: rect.left,
					y: rect.top,
					width: rect.width,
					height: rect.height,
					focus: true,
					dragDropEnabled: false,
				});
				await new Promise<void>((resolve, reject) => {
					view.once("tauri://created", () => resolve());
					view.once("tauri://error", (event) => {
						reject(
							new Error(String(event.payload ?? "webview failed")),
						);
					});
				});
				if (cancelled) {
					await view.close().catch(() => undefined);
					return;
				}
				viewRef.current = view;
				viewUrl.current = target;
			} catch (caught) {
				console.error("gpio-companion-desktop t3 webview", caught);
				setNative(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [native, target, visible, ready]);

	useEffect(() => {
		if (!native || !viewRef.current) {
			return;
		}
		if (!visible || !ready) {
			void viewRef.current.hide();
			return;
		}
		void viewRef.current.setPosition(
			new LogicalPosition(rect.left, rect.top),
		);
		void viewRef.current.setSize(new LogicalSize(rect.width, rect.height));
		void viewRef.current.show();
	}, [native, visible, ready, rect.left, rect.top, rect.width, rect.height]);

	useEffect(() => {
		return () => {
			void viewRef.current?.close().catch(() => undefined);
			viewRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (native) {
			return;
		}
		const el = iframeRef.current;
		if (!el || !target) {
			return;
		}
		const navKey = `${uuid}\0${pairToken}`;
		if (assigned.current === navKey) {
			return;
		}
		assigned.current = navKey;
		el.src = target;
	}, [native, uuid, pairToken, target]);

	if (!uuid) {
		return null;
	}

	return (
		<div
			aria-hidden={!visible}
			style={{
				position: "fixed",
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
				visibility: visible && !native ? "visible" : "hidden",
				pointerEvents: visible && !native ? "auto" : "none",
				zIndex: 10,
			}}
		>
			{native ? null : (
				<iframe
					ref={iframeRef}
					title="T3 Code"
					allow="clipboard-read; clipboard-write; fullscreen"
					style={{ width: "100%", height: "100%", border: 0 }}
				/>
			)}
		</div>
	);
}

export { SLOT_ID as T3_FRAME_SLOT_ID };
