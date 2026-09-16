import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { LOCALES } from "gpio-companion/i18n";
import { asLocale, useLocale } from "../hooks/useLocale.tsx";

export default function LanguageCard() {
	const { locale, setLocale, t } = useLocale();

	return (
		<Paper className="w-full max-w-2xl p-4 min-[900px]:p-6" elevation={1}>
			<Stack spacing={1}>
				<Typography variant="h6">{t("language.title")}</Typography>
				<Typography color="secondary">{t("language.hint")}</Typography>
				<Select
					name="locale"
					label={t("language.title")}
					value={locale}
					onSelect={(next) => setLocale(asLocale(next))}
					className="w-full max-w-xs"
				>
					{LOCALES.map((entry) => (
						<option key={entry.code} value={entry.code}>
							{entry.nativeLabel}
						</option>
					))}
				</Select>
			</Stack>
		</Paper>
	);
}
