import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { mintVoiceTicket } from "../lib/api.ts";
import { useAuth } from "../lib/auth.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { useLocale, useT } from "../lib/locale.tsx";
import { storageGet, storageSet } from "../lib/storage.ts";
import {
	encodeVoiceClient,
	parseVoiceId,
	parseVoiceMicMode,
	parseVoiceServerMessage,
	VOICE_ID_STORAGE_KEY,
	VOICE_MIC_STORAGE_KEY,
	VOICE_SPEAKERS,
	type VoiceMicMode,
	WAKE_PHRASE_LABEL,
} from "../lib/voice.ts";
import { Body, ErrorText, Muted, Paper, PrimaryButton } from "./ui.tsx";

export default function TalkPanel({
	uuid,
	repo,
	owner,
}: {
	uuid: string;
	repo: string;
	owner?: string;
}) {
	const t = useT();
	const { locale } = useLocale();
	const auth = useAuth();
	const colors = useColors();
	const [mode, setMode] = useState<VoiceMicMode>("hold");
	const [voice, setVoice] = useState("eve");
	const [state, setState] = useState<
		"idle" | "listening" | "talking" | "working"
	>("idle");
	const [billed, setBilled] = useState(false);
	const [error, setError] = useState("");
	const [heard, setHeard] = useState("");
	const socketRef = useRef<WebSocket | null>(null);
	const pulse = useRef(new Animated.Value(1)).current;
	const live =
		billed ||
		state === "talking" ||
		state === "listening" ||
		state === "working";

	useEffect(() => {
		void storageGet(VOICE_MIC_STORAGE_KEY).then((stored) => {
			setMode(parseVoiceMicMode(stored));
		});
		void storageGet(VOICE_ID_STORAGE_KEY).then((stored) => {
			setVoice(parseVoiceId(stored));
		});
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: unmount only
	useEffect(() => () => stopAll(), []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: arm always-listen once per board
	useEffect(() => {
		if (mode !== "always" || !uuid || !auth.token) {
			return;
		}
		void startSession();
		return () => stopAll();
	}, [mode, uuid, auth.token]);

	useEffect(() => {
		if (!live) {
			pulse.setValue(1);
			return;
		}
		const anim = Animated.loop(
			Animated.sequence([
				Animated.timing(pulse, {
					toValue: 1.45,
					duration: 800,
					useNativeDriver: true,
				}),
				Animated.timing(pulse, {
					toValue: 1,
					duration: 800,
					useNativeDriver: true,
				}),
			]),
		);
		anim.start();
		return () => {
			anim.stop();
		};
	}, [live, pulse]);

	async function startSession() {
		if (!uuid || !auth.token || socketRef.current) {
			return;
		}
		setError("");
		setHeard("");
		try {
			const ticket = await mintVoiceTicket(auth.token, uuid);
			const socket = new WebSocket(ticket.wsUrl);
			socketRef.current = socket;
			socket.onmessage = (event) => {
				if (typeof event.data !== "string") {
					return;
				}
				const message = parseVoiceServerMessage(event.data);
				if (!message) {
					return;
				}
				if (message.type === "heard" && message.text) {
					setHeard(message.text.trim());
				}
				if (message.state) {
					setState(message.state);
				}
				if (typeof message.billed === "boolean") {
					setBilled(message.billed);
				}
				if (message.type === "error" && message.text) {
					setError(message.text);
				}
			};
			socket.onclose = () => {
				socketRef.current = null;
				setBilled(false);
				setState("idle");
			};
			await new Promise<void>((resolve, reject) => {
				socket.onopen = () => resolve();
				socket.onerror = () => reject(new Error("voice connect failed"));
			});
			socket.send(
				encodeVoiceClient({
					type: "hello",
					locale,
					mode,
					repo,
					owner,
					voice,
				}),
			);
			socket.send(
				encodeVoiceClient({
					type: "start",
					repo,
					owner,
					locale,
					mode,
					voice,
				}),
			);
			setState("talking");
			setBilled(true);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : t("talk.micDenied"));
			stopAll();
		}
	}

	function stopAll() {
		const socket = socketRef.current;
		if (socket) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(encodeVoiceClient({ type: "stop" }));
			}
			socket.close();
		}
		socketRef.current = null;
		setBilled(false);
		setHeard("");
		setState("idle");
	}

	const chip =
		state === "working"
			? t("talk.working")
			: billed
				? t("talk.talking")
				: t("talk.title");

	return (
		<Paper>
			<Body>{t("talk.title")}</Body>
			<Muted>{chip}</Muted>
			<Muted>{t("talk.hint")}</Muted>
			<Body>{t("talk.sayWake", { phrase: WAKE_PHRASE_LABEL })}</Body>
			<Muted>{t("talk.voice")}</Muted>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{VOICE_SPEAKERS.map((speaker) => {
					const selected = speaker.id === voice;
					return (
						<Pressable
							key={speaker.id}
							onPress={() => {
								setVoice(speaker.id);
								void storageSet(VOICE_ID_STORAGE_KEY, speaker.id);
							}}
							style={{
								paddingVertical: 8,
								paddingHorizontal: 14,
								borderRadius: 999,
								borderWidth: selected ? 2 : 1,
								borderColor: selected ? colors.primary : colors.border,
								backgroundColor: selected ? colors.primary : colors.surface,
							}}
						>
							<Text
								style={{
									color: selected ? colors.primaryText : colors.text,
									fontWeight: "600",
								}}
							>
								{speaker.name}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<ErrorText>{error}</ErrorText>
			{live ? (
				<View style={{ alignItems: "center", paddingTop: 8, gap: 10 }}>
					<View
						style={{
							maxWidth: 280,
							maxHeight: 72,
							overflow: "hidden",
							borderRadius: 12,
							paddingHorizontal: 12,
							paddingVertical: 8,
							backgroundColor: colors.chipBg,
						}}
					>
						<Text
							style={{
								color: colors.muted,
								fontSize: 13,
								textAlign: "center",
							}}
						>
							{heard || t("talk.listening")}
						</Text>
					</View>
					<Pressable
						onPress={() => stopAll()}
						accessibilityLabel={t("talk.stop")}
						style={{
							width: 64,
							height: 64,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Animated.View
							style={{
								position: "absolute",
								width: 64,
								height: 64,
								borderRadius: 32,
								backgroundColor: colors.primary,
								opacity: 0.28,
								transform: [{ scale: pulse }],
							}}
						/>
						<View
							style={{
								width: 56,
								height: 56,
								borderRadius: 28,
								backgroundColor: colors.surface,
								alignItems: "center",
								justifyContent: "center",
								borderWidth: 1,
								borderColor: colors.primary,
							}}
						>
							<View
								style={{
									width: 12,
									height: 20,
									borderRadius: 6,
									backgroundColor: colors.primary,
								}}
							/>
							<View
								style={{
									width: 16,
									height: 8,
									marginTop: 2,
									borderBottomLeftRadius: 8,
									borderBottomRightRadius: 8,
									borderWidth: 2,
									borderTopWidth: 0,
									borderColor: colors.primary,
								}}
							/>
						</View>
					</Pressable>
				</View>
			) : (
				<PrimaryButton
					label={t("talk.press")}
					onPress={() => void startSession()}
				/>
			)}
		</Paper>
	);
}
