import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "../lib/color-mode.tsx";
import { useT } from "../lib/locale.tsx";
import { storageGet, storageSet } from "../lib/storage.ts";
import {
	parseVoiceId,
	parseVoiceMicMode,
	VOICE_ID_STORAGE_KEY,
	VOICE_MIC_STORAGE_KEY,
	VOICE_SPEAKERS,
	type VoiceMicMode,
	WAKE_PHRASE_LABEL,
} from "../lib/voice.ts";
import { Body, Muted, Paper } from "./ui.tsx";

const MODES: VoiceMicMode[] = ["hold", "always", "wake"];

export default function VoiceMicCard() {
	const t = useT();
	const colors = useColors();
	const [mode, setModeState] = useState<VoiceMicMode>("hold");
	const [voice, setVoiceState] = useState("eve");

	useEffect(() => {
		void storageGet(VOICE_MIC_STORAGE_KEY).then((stored) => {
			setModeState(parseVoiceMicMode(stored));
		});
		void storageGet(VOICE_ID_STORAGE_KEY).then((stored) => {
			setVoiceState(parseVoiceId(stored));
		});
	}, []);

	const setMode = useCallback((next: VoiceMicMode) => {
		setModeState(next);
		void storageSet(VOICE_MIC_STORAGE_KEY, next);
	}, []);
	const setVoice = useCallback((next: string) => {
		const id = parseVoiceId(next);
		setVoiceState(id);
		void storageSet(VOICE_ID_STORAGE_KEY, id);
	}, []);

	return (
		<Paper>
			<Body>{t("profile.voiceTitle")}</Body>
			<Muted>{t("profile.voiceHint")}</Muted>
			<Body>{t("talk.sayWake", { phrase: WAKE_PHRASE_LABEL })}</Body>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{MODES.map((entry) => {
					const selected = entry === mode;
					const label =
						entry === "hold"
							? t("talk.hold")
							: entry === "always"
								? t("talk.always")
								: t("talk.wake");
					return (
						<Pressable
							key={entry}
							onPress={() => setMode(entry)}
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
								{label}
							</Text>
						</Pressable>
					);
				})}
			</View>
			<Muted>{t("talk.voice")}</Muted>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
				{VOICE_SPEAKERS.map((speaker) => {
					const selected = speaker.id === voice;
					return (
						<Pressable
							key={speaker.id}
							onPress={() => setVoice(speaker.id)}
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
		</Paper>
	);
}
