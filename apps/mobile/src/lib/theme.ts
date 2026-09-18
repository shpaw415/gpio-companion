export type ColorMode = "light" | "dark";

export type Colors = {
	bg: string;
	surface: string;
	text: string;
	muted: string;
	placeholder: string;
	border: string;
	primary: string;
	primaryText: string;
	danger: string;
	success: string;
	warning: string;
	chipBg: string;
};

export const palettes: Record<ColorMode, Colors> = {
	light: {
		bg: "#edf3f1",
		surface: "#f9fbfa",
		text: "#17211f",
		muted: "#5a6966",
		placeholder: "#5a6966",
		border: "#c5d0cd",
		primary: "#006b60",
		primaryText: "#ffffff",
		danger: "#c5221f",
		success: "#176b45",
		warning: "#b4540a",
		chipBg: "#e0ebe8",
	},
	dark: {
		bg: "#0c1415",
		surface: "#162022",
		text: "#e2ebe8",
		muted: "#9caaa7",
		placeholder: "#9caaa7",
		border: "#334441",
		primary: "#64d8c9",
		primaryText: "#08201d",
		danger: "#f28b82",
		success: "#79d3a2",
		warning: "#ffb74d",
		chipBg: "#20302e",
	},
};

export const colors = palettes.light;
