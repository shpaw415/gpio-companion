import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
	BREADBOARD_EMBED_MESSAGE_TYPE,
	type BreadboardEmbedPayload,
	breadboardEmbedScript,
	mobileBreadboardEmbedUrl,
} from "../lib/breadboard-embed.ts";
import { useColorMode, useColors } from "../lib/color-mode.tsx";
import { dashboardUrl } from "../lib/config.ts";
import { useLocale, useT } from "../lib/locale.tsx";
import { Muted, Paper } from "./ui.tsx";
import ZoomableImage from "./ZoomableImage.tsx";

export default function BreadboardWebView({
	diagramText,
	previewUrl,
	livePins,
	arduinoLivePins,
	verifyResults,
	boardModel,
}: {
	diagramText?: string | null;
	previewUrl?: string | null;
	livePins?: Record<number, 0 | 1>;
	arduinoLivePins?: Record<number, 0 | 1>;
	verifyResults?: BreadboardEmbedPayload["verifyResults"];
	boardModel?: string | null;
}) {
	const t = useT();
	const colors = useColors();
	const { locale } = useLocale();
	const { mode } = useColorMode();
	const [open, setOpen] = useState(false);
	const [failed, setFailed] = useState(false);
	const payload: BreadboardEmbedPayload = {
		type: BREADBOARD_EMBED_MESSAGE_TYPE,
		diagramText,
		previewUrl,
		livePins,
		arduinoLivePins,
		verifyResults,
		boardModel,
	};

	if (failed && previewUrl) {
		return <ZoomableImage title={t("project.breadboard")} uri={previewUrl} />;
	}

	if (failed) {
		return (
			<Paper>
				<Muted>{t("project.noBreadboard")}</Muted>
			</Paper>
		);
	}

	return (
		<Paper>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: 8,
				}}
			>
				<Text style={{ color: colors.muted }}>{t("project.breadboard")}</Text>
				<Pressable onPress={() => setOpen(true)} style={{ paddingVertical: 4 }}>
					<Text style={{ color: colors.primary, fontWeight: "600" }}>
						{t("board.fullScreen")}
					</Text>
				</Pressable>
			</View>
			<View style={{ height: 320, borderRadius: 8, overflow: "hidden" }}>
				<EmbedFrame
					payload={payload}
					locale={locale}
					theme={mode}
					onFail={() => setFailed(true)}
				/>
			</View>
			<Modal
				animationType="fade"
				onRequestClose={() => setOpen(false)}
				visible={open}
			>
				<EmbedModal
					locale={locale}
					onClose={() => setOpen(false)}
					payload={payload}
					theme={mode}
					title={t("project.breadboard")}
					onFail={() => {
						setOpen(false);
						setFailed(true);
					}}
				/>
			</Modal>
		</Paper>
	);
}

function EmbedModal({
	payload,
	locale,
	theme,
	title,
	onClose,
	onFail,
}: {
	payload: BreadboardEmbedPayload;
	locale: string;
	theme: string;
	title: string;
	onClose: () => void;
	onFail: () => void;
}) {
	const t = useT();
	const colors = useColors();
	const insets = useSafeAreaInsets();
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg }}>
			<View
				style={{
					paddingTop: insets.top + 8,
					paddingHorizontal: 16,
					paddingBottom: 8,
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "center",
				}}
			>
				<Text style={{ color: colors.text, fontWeight: "600" }}>{title}</Text>
				<Pressable onPress={onClose} style={{ paddingVertical: 8 }}>
					<Text style={{ color: colors.primary, fontWeight: "600" }}>
						{t("common.close")}
					</Text>
				</Pressable>
			</View>
			<View style={{ flex: 1 }}>
				<EmbedFrame
					payload={payload}
					locale={locale}
					theme={theme}
					onFail={onFail}
				/>
			</View>
		</View>
	);
}

function EmbedFrame({
	payload,
	locale,
	theme,
	onFail,
}: {
	payload: BreadboardEmbedPayload;
	locale: string;
	theme: string;
	onFail: () => void;
}) {
	const webRef = useRef<WebView>(null);
	const uri = mobileBreadboardEmbedUrl(dashboardUrl, { locale, theme });
	const script = breadboardEmbedScript(payload);

	useEffect(() => {
		webRef.current?.injectJavaScript(script);
	}, [script]);

	return (
		<WebView
			ref={webRef}
			source={{ uri }}
			style={{ flex: 1, backgroundColor: "transparent" }}
			javaScriptEnabled
			domStorageEnabled
			nestedScrollEnabled
			originWhitelist={["https://*"]}
			setSupportMultipleWindows={false}
			onError={onFail}
			onHttpError={onFail}
			onLoadEnd={() => {
				webRef.current?.injectJavaScript(script);
			}}
		/>
	);
}
