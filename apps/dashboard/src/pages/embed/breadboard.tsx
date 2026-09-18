import BreadboardViewer from "@components/BreadboardViewer";
import Box from "@shpaw415/mui-lite/Box";
import {
	BREADBOARD_EMBED_MESSAGE_TYPE,
	type BreadboardEmbedPayload,
	type CircuitVerifyItem,
	circuitVerifyOverlay,
	parseBreadboardEmbedMessage,
	parseWokwiDiagram,
} from "gpio-companion";
import { parseLocale } from "gpio-companion/i18n";
import { useEffect, useMemo, useState } from "react";
import { useColorMode } from "../../hooks/useColorMode.tsx";
import { useLocale } from "../../hooks/useLocale.tsx";

function emptyPayload(): BreadboardEmbedPayload {
	return { type: BREADBOARD_EMBED_MESSAGE_TYPE };
}

function readSearch(): { locale?: string; theme?: string } {
	if (typeof window === "undefined") {
		return {};
	}
	const params = new URLSearchParams(window.location.search);
	return {
		locale: params.get("locale") ?? undefined,
		theme: params.get("theme") ?? undefined,
	};
}

export default function BreadboardEmbedPage() {
	const { setLocale } = useLocale();
	const { setMode } = useColorMode();
	const [payload, setPayload] = useState<BreadboardEmbedPayload>(emptyPayload);

	useEffect(() => {
		const search = readSearch();
		const locale = parseLocale(search.locale ?? "");
		if (locale) {
			setLocale(locale);
		}
		if (search.theme === "dark" || search.theme === "light") {
			setMode(search.theme);
		}
	}, [setLocale, setMode]);

	useEffect(() => {
		function apply(data: unknown) {
			const next = parseBreadboardEmbedMessage(data);
			if (next) {
				setPayload(next);
			}
		}
		function onMessage(event: MessageEvent) {
			if (event.origin && event.origin !== window.location.origin) {
				return;
			}
			apply(event.data);
		}
		const bridge = window as Window & {
			__gpioBreadboardEmbed?: (data: unknown) => void;
			ReactNativeWebView?: { postMessage: (message: string) => void };
		};
		bridge.__gpioBreadboardEmbed = apply;
		window.addEventListener("message", onMessage);
		window.parent.postMessage({ type: "gpio-breadboard-ready" }, "*");
		bridge.ReactNativeWebView?.postMessage(
			JSON.stringify({ type: "gpio-breadboard-ready" }),
		);
		return () => {
			window.removeEventListener("message", onMessage);
			delete bridge.__gpioBreadboardEmbed;
		};
	}, []);

	const overlay = useMemo(() => {
		if (!payload.diagramText || !payload.verifyResults?.length) {
			return undefined;
		}
		try {
			return circuitVerifyOverlay(
				parseWokwiDiagram(payload.diagramText),
				payload.verifyResults as CircuitVerifyItem[],
			);
		} catch {
			return undefined;
		}
	}, [payload.diagramText, payload.verifyResults]);

	return (
		<Box sx={{ height: "100dvh", minHeight: 0, display: "flex" }}>
			<Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
				<BreadboardViewer
					diagramText={payload.diagramText}
					previewUrl={payload.previewUrl}
					livePins={payload.livePins}
					arduinoLivePins={payload.arduinoLivePins}
					verifyOverlay={overlay}
					boardModel={payload.boardModel}
					fill
				/>
			</Box>
		</Box>
	);
}
