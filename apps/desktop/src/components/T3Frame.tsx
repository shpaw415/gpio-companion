import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t3IframeSrc } from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";

const CHROME = "[data-t3-chrome]";

export default function T3Frame({ visible }: { visible: boolean }) {
	const { uuid, pairToken } = useBoardSelection();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const assigned = useRef("");
	const [top, setTop] = useState(0);

	useLayoutEffect(() => {
		if (!visible) {
			return;
		}
		const sync = () => {
			const chrome = document.querySelector(CHROME);
			setTop(chrome ? chrome.getBoundingClientRect().bottom : 0);
		};
		sync();
		window.addEventListener("resize", sync);
		const timer = window.setInterval(sync, 250);
		return () => {
			window.removeEventListener("resize", sync);
			window.clearInterval(timer);
		};
	}, [visible, uuid]);

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

	if (!uuid) {
		return null;
	}

	return (
		<iframe
			ref={iframeRef}
			title="T3 Code"
			allow="clipboard-read; clipboard-write; fullscreen"
			style={{
				position: "fixed",
				top,
				left: 0,
				width: "100vw",
				height: `calc(100vh - ${top}px)`,
				border: 0,
				zIndex: 30,
				visibility: visible ? "visible" : "hidden",
				pointerEvents: visible ? "auto" : "none",
				background: "#111",
			}}
		/>
	);
}

export const T3_FRAME_SLOT_ID = "gpio-t3-frame-slot";
