import { useEffect, useState } from "react";
import { usePathname } from "../hooks/usePathname.tsx";
import { useT3Session } from "../hooks/useT3Session.tsx";
import { isT3Path, T3_FRAME_SLOT_ID, t3EmbedUrl } from "../lib/t3-url.ts";

type FrameRect = {
	top: number;
	left: number;
	width: number;
	height: number;
};

export default function T3Frame() {
	const pathname = usePathname();
	const { uuid } = useT3Session();
	const visible = isT3Path(pathname);
	const nextSrc = t3EmbedUrl(uuid);
	const [src, setSrc] = useState("");
	const [rect, setRect] = useState<FrameRect>({
		top: 0,
		left: 0,
		width: 0,
		height: 0,
	});

	useEffect(() => {
		if (nextSrc) {
			setSrc(nextSrc);
		}
	}, [nextSrc]);

	useEffect(() => {
		if (!src || !visible) {
			return;
		}

		let cancelled = false;
		let observer: ResizeObserver | null = null;
		let frame = 0;

		const sync = () => {
			const slot = document.getElementById(T3_FRAME_SLOT_ID);
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

		const waitForSlot = () => {
			if (cancelled) {
				return;
			}
			const slot = document.getElementById(T3_FRAME_SLOT_ID);
			if (!slot) {
				frame = window.requestAnimationFrame(waitForSlot);
				return;
			}
			sync();
			if (typeof ResizeObserver !== "undefined") {
				observer = new ResizeObserver(sync);
				observer.observe(slot);
			}
		};

		waitForSlot();
		window.addEventListener("resize", sync);
		window.addEventListener("scroll", sync, true);
		return () => {
			cancelled = true;
			window.cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener("resize", sync);
			window.removeEventListener("scroll", sync, true);
		};
	}, [src, visible]);

	if (!src) {
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
				title="T3 Code"
				src={src}
				allow="clipboard-read; clipboard-write; fullscreen"
				style={{ width: "100%", height: "100%", border: 0 }}
			/>
		</div>
	);
}
