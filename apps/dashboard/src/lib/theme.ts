import { DefaultTheme, type MuiTheme } from "@shpaw415/mui-lite/theme";

export type ColorMode = "light" | "dark";

export function createAppTheme(mode: ColorMode = "dark"): MuiTheme {
	return {
		...DefaultTheme,
		theme: mode,
	};
}

export const theme = createAppTheme("dark");
