import { DefaultTheme, type MuiTheme } from "@shpaw415/mui-lite/theme";

export type ColorMode = "light" | "dark";

type Scheme = { light: string; dark: string; main: string };

function scheme(lightValue: string, darkValue: string): Scheme {
	return { light: lightValue, dark: darkValue, main: lightValue };
}

export function createAppTheme(mode: ColorMode = "dark"): MuiTheme {
	return {
		...DefaultTheme,
		"bg-main": scheme("#f5f6f8", "#101418"),
		"bg-surface": scheme("#ffffff", "#1a1f24"),
		"bg-primary": scheme("#1976d2", "#1565c0"),
		"bg-secondary": scheme("#9c27b0", "#7b1fa2"),
		"bg-success": scheme("#2e7d32", "#388e3c"),
		"bg-error": scheme("#d32f2f", "#c62828"),
		"bg-warning": scheme("#ed6c02", "#f57c00"),
		"text-main": scheme("#1a1d21", "#e3e6ea"),
		"text-secondary": scheme("#5f6368", "#9aa3af"),
		"text-primary": scheme("#1565c0", "#8ab4f8"),
		"text-success": scheme("#1e7b34", "#81c995"),
		"text-error": scheme("#c5221f", "#f28b82"),
		"text-warning": scheme("#b4540a", "#ffb74d"),
		"text-info": scheme("#0b57d0", "#78b4ff"),
		theme: mode,
		locale: "enUS",
	};
}
