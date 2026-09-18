import { DefaultTheme, type MuiTheme } from "@shpaw415/mui-lite/theme";

export type ColorMode = "light" | "dark";

type Scheme = { light: string; dark: string; main: string };

function scheme(lightValue: string, darkValue: string): Scheme {
	return { light: lightValue, dark: darkValue, main: lightValue };
}

export function createAppTheme(mode: ColorMode = "dark"): MuiTheme {
	return {
		...DefaultTheme,
		"bg-main": scheme("#edf3f1", "#0c1415"),
		"bg-surface": scheme("#f9fbfa", "#162022"),
		"bg-primary": scheme("#087f73", "#3fb8aa"),
		"bg-secondary": scheme("#536b67", "#607d78"),
		"bg-success": scheme("#247a52", "#56ad7f"),
		"bg-error": scheme("#d32f2f", "#c62828"),
		"bg-warning": scheme("#ed6c02", "#f57c00"),
		"text-main": scheme("#17211f", "#e2ebe8"),
		"text-secondary": scheme("#5a6966", "#9caaa7"),
		"text-primary": scheme("#006b60", "#64d8c9"),
		"text-success": scheme("#176b45", "#79d3a2"),
		"text-error": scheme("#c5221f", "#f28b82"),
		"text-warning": scheme("#b4540a", "#ffb74d"),
		"text-info": scheme("#0b57d0", "#78b4ff"),
		theme: mode,
		locale: "enUS",
	};
}
