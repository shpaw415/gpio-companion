import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { parseVoiceMicMode } from "gpio-companion";
import { useT } from "../hooks/useLocale.tsx";
import { useVoiceMic } from "../hooks/useVoiceMic.ts";

export default function VoiceMicCard() {
	const { mode, setMode } = useVoiceMic();
	const t = useT();

	return (
		<Paper className="w-full p-3" elevation={1}>
			<Stack spacing={1}>
				<Typography variant="subtitle1">{t("profile.voiceTitle")}</Typography>
				<Typography color="secondary">{t("profile.voiceHint")}</Typography>
				<Select
					name="voice-mic"
					label={t("profile.voiceTitle")}
					value={mode}
					onSelect={(next) => setMode(parseVoiceMicMode(next))}
					className="w-full max-w-xs"
				>
					<option value="hold">{t("talk.hold")}</option>
					<option value="always">{t("talk.always")}</option>
					<option value="wake">{t("talk.wake")}</option>
				</Select>
			</Stack>
		</Paper>
	);
}
