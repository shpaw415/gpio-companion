import { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { t3AppUrl, t3IframeSrc } from "../lib/t3.ts";

export default function T3WebView({ visible }: { visible: boolean }) {
	const { uuid, pairToken } = useBoardSelection();
	const urlRef = useRef("");
	const home = t3AppUrl(uuid);
	const want = pairToken ? t3IframeSrc(uuid, pairToken) : urlRef.current || home;

	useEffect(() => {
		if (want) {
			urlRef.current = want;
		}
	}, [want]);

	if (!home) {
		return null;
	}

	return (
		<View
			pointerEvents={visible ? "auto" : "none"}
			style={
				visible
					? { flex: 1, minHeight: 0 }
					: { height: 0, width: 0, opacity: 0, overflow: "hidden" }
			}
		>
			<WebView
				source={{ uri: want }}
				style={{ flex: 1, backgroundColor: "transparent" }}
				javaScriptEnabled
				domStorageEnabled
				sharedCookiesEnabled
				thirdPartyCookiesEnabled
				setSupportMultipleWindows={false}
				allowsBackForwardNavigationGestures
			/>
		</View>
	);
}
