import IconButton from "@shpaw415/mui-lite/IconButton";
import { useColorMode } from "../hooks/useColorMode.tsx";
import { useT } from "../hooks/useLocale.tsx";
import { MoonIcon, SunIcon } from "./icons.tsx";

export default function ColorModeButton() {
	const { isDark, toggleMode } = useColorMode();
	const t = useT();
	const label = isDark ? t("theme.light") : t("theme.dark");
	return (
		<IconButton aria-label={label} title={label} onClick={toggleMode}>
			{isDark ? <SunIcon /> : <MoonIcon />}
		</IconButton>
	);
}
