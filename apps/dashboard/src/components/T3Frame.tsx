import { useEffect, useState } from "react";
import { useBoardSelection } from "../hooks/useBoardSelection.tsx";
import useMobile from "../hooks/useMobile.ts";
import { usePathname } from "../hooks/usePathname.tsx";
import {
	DASHBOARD_BOTTOM_NAV_ID,
	isT3Path,
	readT3PairLocation,
	T3_FRAME_SLOT_ID,
	t3IframeSrc,
} from "../lib/t3-url.ts";

type FrameRect = {
	top: number;
	left: number;
	width: number;
	height: number;
};

function frameBottom(mobile: boolean): number {
	if (!mobile) {
		return window.innerHeight;
	}
	const nav = document.getElementById(DASHBOARD_BOTTOM_NAV_ID);
	if (!nav) {
		return window.innerHeight;
	}
	return nav.getBoundingClientRect().top;
}

export default function T3Frame() {
	const pathname = usePathname();
	const mobile = useMobile();
	const { uuid, setUuid } = useBoardSelection();
	const visible = isT3Path(pathname);
	const [pairToken, setPairToken] = useState("");
	const nextSrc = t3IframeSrc(uuid, pairToken);
	const [src, setSrc] = useState("");
	const [rect, setRect] = useState<FrameRect>({
		top: 0,
		left: 0,
		width: 0,
		height: 0,
	});

	useEffect(() => {
		const apply = () => {
			const next = readT3PairLocation();
			if (next.uuid && isT3Path(pathname)) {
				setUuid(next.uuid);
			}
			setPairToken(next.token);
		};
		apply();
		window.addEventListener("hashchange", apply);
		return () => window.removeEventListener("hashchange", apply);
	}, [pathname, setUuid]);

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
				height: Math.max(0, frameBottom(mobile) - next.top),
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
	}, [src, visible, mobile]);

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
