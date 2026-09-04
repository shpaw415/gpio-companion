import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t3AppUrl, t3IframeSrc } from "../api";
import { useBoardSelection } from "../hooks/useBoardSelection";

const CHROME = "[data-t3-chrome]";

export default function T3Frame({ visible }: { visible: boolean }) {
	const { uuid, pairToken, clearPairToken } = useBoardSelection();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const assigned = useRef("");
	const loads = useRef(0);
	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const pairRef = useRef(pairToken);
	pairRef.current = pairToken;
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

	function goHome(el: HTMLIFrameElement) {
		const home = t3AppUrl(uuidRef.current);
		pairRef.current = "";
		clearPairToken();
		assigned.current = `${uuidRef.current}\0`;
		if (home) {
			el.src = home;
		}
	}

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
		loads.current = 0;
		el.src = target;
	}, [uuid, pairToken]);

	useEffect(() => {
		const el = iframeRef.current;
		if (!el) {
			return;
		}
		let timer = 0;
		const onLoad = () => {
			loads.current += 1;
			if (!pairRef.current) {
				return;
			}
			if (loads.current >= 2) {
				goHome(el);
				return;
			}
			timer = window.setTimeout(() => {
				if (pairRef.current) {
					goHome(el);
				}
			}, 4000);
		};
		el.addEventListener("load", onLoad);
		return () => {
			el.removeEventListener("load", onLoad);
			window.clearTimeout(timer);
		};
	}, [clearPairToken]);

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
