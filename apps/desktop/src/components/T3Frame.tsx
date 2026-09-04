import { useEffect, useRef, useState } from "react";
import { t3IframeSrc } from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";

const SLOT_ID = "gpio-t3-frame-slot";

export default function T3Frame({ visible }: { visible: boolean }) {
	const { uuid, pairToken } = useBoardSelection();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const assigned = useRef("");
	const [rect, setRect] = useState({
		top: 0,
		left: 0,
		width: 0,
		height: 0,
	});

	useEffect(() => {
		const el = iframeRef.current;
		const target = t3IframeSrc(uuid, pairToken);
		if (!el || !target) {
			return;
		}
		const navKey = `${uuid}\0${pairToken}`;
		if (assigned.current === navKey) {
			return;
		}
		assigned.current = navKey;
		el.src = target;
	}, [uuid, pairToken]);

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
				width: next.width,
				height: next.height,
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
				visibility: visible ? "visible" : "hidden",
				pointerEvents: visible ? "auto" : "none",
				zIndex: 10,
			}}
		>
			<iframe
				ref={iframeRef}
				title="T3 Code"
				allow="clipboard-read; clipboard-write; fullscreen"
				style={{ width: "100%", height: "100%", border: 0 }}
			/>
		</div>
	);
}

export { SLOT_ID as T3_FRAME_SLOT_ID };
