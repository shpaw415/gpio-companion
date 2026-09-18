import Select from "@shpaw415/mui-lite/Select";
import { useLocale } from "../hooks/useLocale.tsx";

export type LanguageSwitcherProps = {
	compact?: boolean;
	className?: string;
};

export default function LanguageSwitcher({
	compact = false,
	className,
}: LanguageSwitcherProps) {
	const { locale, setLocale, t } = useLocale();
	return (
		<Select
			name="marketplace-locale"
			label={compact ? undefined : t("language.label")}
			aria-label={t("language.label")}
			value={locale}
			onSelect={(value) => setLocale(value === "fr" ? "fr" : "en")}
			className={className ?? (compact ? "market-language-compact" : "w-full")}
		>
			<option value="en">EN</option>
			<option value="fr">FR</option>
		</Select>
	);
}
