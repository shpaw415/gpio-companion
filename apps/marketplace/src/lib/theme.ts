import { DefaultTheme, type MuiTheme } from "@shpaw415/mui-lite/theme";

export type ColorMode = "light" | "dark";

function scheme(light: string, dark: string) {
	return { light, dark, main: light };
}

export function createMarketplaceTheme(mode: ColorMode = "light"): MuiTheme {
	return {
		...DefaultTheme,
		"bg-main": scheme("#f3f5ef", "#0c1413"),
		"bg-surface": scheme("#fcfdf8", "#151f1d"),
		"bg-primary": scheme("#006b61", "#65d9ca"),
		"bg-secondary": scheme("#725c00", "#e6c34a"),
		"bg-success": scheme("#2d6b45", "#84d69f"),
		"bg-error": scheme("#ba1a1a", "#ffb4ab"),
		"bg-warning": scheme("#8b5000", "#ffb95f"),
		"text-main": scheme("#17201e", "#dce7e3"),
		"text-secondary": scheme("#52615e", "#a8b7b3"),
		"text-primary": scheme("#005048", "#78e7d7"),
		"text-success": scheme("#245c3b", "#8bddaa"),
		"text-error": scheme("#93000a", "#ffb4ab"),
		"text-warning": scheme("#6d3c00", "#ffcb82"),
		"text-info": scheme("#245e64", "#9ed7dd"),
		theme: mode,
		locale: "enUS",
	};
}

export const marketplaceTheme = createMarketplaceTheme();
