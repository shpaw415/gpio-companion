import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useState } from "react";
import {
	parseVoiceId,
	parseVoiceMicMode,
	VOICE_ID_STORAGE_KEY,
	VOICE_MIC_STORAGE_KEY,
	VOICE_SPEAKERS,
	type VoiceMicMode,
	WAKE_PHRASE_LABEL,
} from "../lib/voice";
import { useT } from "../locale";

function readStoredMode(): VoiceMicMode {
	try {
		return parseVoiceMicMode(
			window.localStorage.getItem(VOICE_MIC_STORAGE_KEY),
		);
	} catch {
		return "hold";
	}
}

function readStoredVoice(): string {
	try {
		return parseVoiceId(window.localStorage.getItem(VOICE_ID_STORAGE_KEY));
	} catch {
		return "eve";
	}
}

export default function VoiceMicCard() {
	const t = useT();
	const [mode, setModeState] = useState<VoiceMicMode>(readStoredMode);
	const [voice, setVoiceState] = useState(readStoredVoice);
	const setMode = useCallback((next: VoiceMicMode) => {
		setModeState(next);
		try {
			window.localStorage.setItem(VOICE_MIC_STORAGE_KEY, next);
		} catch {
			return;
		}
	}, []);
	const setVoice = useCallback((next: string) => {
		const id = parseVoiceId(next);
		setVoiceState(id);
		try {
			window.localStorage.setItem(VOICE_ID_STORAGE_KEY, id);
		} catch {
			return;
		}
	}, []);

	return (
		<Paper sx={{ p: 1.5 }} elevation={1}>
			<Stack spacing={1}>
				<Typography variant="subtitle1">{t("profile.voiceTitle")}</Typography>
				<Typography color="secondary">{t("profile.voiceHint")}</Typography>
				<Typography>
					{t("talk.sayWake", { phrase: WAKE_PHRASE_LABEL })}
				</Typography>
				<Select
					name="voice-mic"
					label={t("profile.voiceTitle")}
					value={mode}
					onSelect={(next) => setMode(parseVoiceMicMode(next))}
					sx={{ maxWidth: 280 }}
				>
					<option value="hold">{t("talk.hold")}</option>
					<option value="always">{t("talk.always")}</option>
					<option value="wake">{t("talk.wake")}</option>
				</Select>
				<Select
					name="voice-speaker"
					label={t("talk.voice")}
					value={voice}
					onSelect={(next) => setVoice(parseVoiceId(next))}
					sx={{ maxWidth: 280 }}
				>
					{VOICE_SPEAKERS.map((speaker) => (
						<option key={speaker.id} value={speaker.id}>
							{speaker.name}
						</option>
					))}
				</Select>
			</Stack>
		</Paper>
	);
}
