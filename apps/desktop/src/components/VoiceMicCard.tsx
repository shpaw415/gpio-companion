import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useCallback, useState } from "react";
import {
	parseVoiceMicMode,
	VOICE_MIC_STORAGE_KEY,
	type VoiceMicMode,
} from "../lib/voice";
import { useT } from "../locale";

function readStored(): VoiceMicMode {
	try {
		return parseVoiceMicMode(
			window.localStorage.getItem(VOICE_MIC_STORAGE_KEY),
		);
	} catch {
		return "hold";
	}
}

export default function VoiceMicCard() {
	const t = useT();
	const [mode, setModeState] = useState<VoiceMicMode>(readStored);
	const setMode = useCallback((next: VoiceMicMode) => {
		setModeState(next);
		try {
			window.localStorage.setItem(VOICE_MIC_STORAGE_KEY, next);
		} catch {
			return;
		}
	}, []);

	return (
		<Paper sx={{ p: 1.5 }} elevation={1}>
			<Stack spacing={1}>
				<Typography variant="subtitle1">{t("profile.voiceTitle")}</Typography>
				<Typography color="secondary">{t("profile.voiceHint")}</Typography>
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
			</Stack>
		</Paper>
	);
}
