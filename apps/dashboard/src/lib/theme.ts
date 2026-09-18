import { DefaultTheme, type MuiTheme } from "@shpaw415/mui-lite/theme";

export type ColorMode = "light" | "dark";

type Scheme = { light: string; dark: string; main: string };

function scheme(lightValue: string, darkValue: string): Scheme {
	return { light: lightValue, dark: darkValue, main: lightValue };
}

const bgLight = {
	main: "#edf3f1",
	surface: "#f9fbfa",
	primary: "#087f73",
	secondary: "#536b67",
	success: "#247a52",
	error: "#d32f2f",
	warning: "#ed6c02",
};

const bgDark = {
	main: "#0c1415",
	surface: "#162022",
	primary: "#3fb8aa",
	secondary: "#607d78",
	success: "#56ad7f",
	error: "#c62828",
	warning: "#f57c00",
};

const textLight = {
	main: "#17211f",
	secondary: "#5a6966",
	primary: "#006b60",
	success: "#176b45",
	error: "#c5221f",
	warning: "#b4540a",
	info: "#0b57d0",
};

const textDark = {
	main: "#e2ebe8",
	secondary: "#9caaa7",
	primary: "#64d8c9",
	success: "#79d3a2",
	error: "#f28b82",
	warning: "#ffb74d",
	info: "#78b4ff",
};

export function createAppTheme(mode: ColorMode = "dark"): MuiTheme {
	return {
		...DefaultTheme,
		"bg-main": scheme(bgLight.main, bgDark.main),
		"bg-surface": scheme(bgLight.surface, bgDark.surface),
		"bg-primary": scheme(bgLight.primary, bgDark.primary),
		"bg-secondary": scheme(bgLight.secondary, bgDark.secondary),
		"bg-success": scheme(bgLight.success, bgDark.success),
		"bg-error": scheme(bgLight.error, bgDark.error),
		"bg-warning": scheme(bgLight.warning, bgDark.warning),
		"text-main": scheme(textLight.main, textDark.main),
		"text-secondary": scheme(textLight.secondary, textDark.secondary),
		"text-primary": scheme(textLight.primary, textDark.primary),
		"text-success": scheme(textLight.success, textDark.success),
		"text-error": scheme(textLight.error, textDark.error),
		"text-warning": scheme(textLight.warning, textDark.warning),
		"text-info": scheme(textLight.info, textDark.info),
		theme: mode,
		locale: "enUS",
	};
}

export const theme = createAppTheme("dark");
