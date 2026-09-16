import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Typography from "@shpaw415/mui-lite/Typography";
import { LOCALES } from "gpio-companion-i18n";
import { asLocale, useLocale } from "../locale";

export default function LanguageCard() {
	const { locale, setLocale, t } = useLocale();

	return (
		<Paper sx={{ p: 3 }} elevation={1}>
			<Typography variant="subtitle1">{t("language.title")}</Typography>
			<Typography color="secondary">{t("language.hint")}</Typography>
			<Select
				name="locale"
				label={t("language.title")}
				value={locale}
				onSelect={(next) => setLocale(asLocale(next))}
				sx={{ mt: 2, maxWidth: 280 }}
			>
				{LOCALES.map((entry) => (
					<option key={entry.code} value={entry.code}>
						{entry.nativeLabel}
					</option>
				))}
			</Select>
		</Paper>
	);
}
