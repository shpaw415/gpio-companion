import { DefaultTheme, type MuiTheme } from "@shpaw415/mui-lite/theme";

export type ColorMode = "light" | "dark";

type Scheme = { light: string; dark: string; main: string };

function scheme(lightValue: string, darkValue: string): Scheme {
	return { light: lightValue, dark: darkValue, main: lightValue };
}

const bgLight = {
	main: "#f5f6f8",
	surface: "#ffffff",
	primary: "#1976d2",
	secondary: "#9c27b0",
	success: "#2e7d32",
	error: "#d32f2f",
	warning: "#ed6c02",
};

const bgDark = {
	main: "#101418",
	surface: "#1a1f24",
	primary: "#1565c0",
	secondary: "#7b1fa2",
	success: "#388e3c",
	error: "#c62828",
	warning: "#f57c00",
};

const textLight = {
	main: "#1a1d21",
	secondary: "#5f6368",
	primary: "#1565c0",
	success: "#1e7b34",
	error: "#c5221f",
	warning: "#b4540a",
	info: "#0b57d0",
};

const textDark = {
	main: "#e3e6ea",
	secondary: "#9aa3af",
	primary: "#8ab4f8",
	success: "#81c995",
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