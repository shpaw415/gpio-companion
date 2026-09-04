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
		bg: "#f5f6f8",
		surface: "#ffffff",
		text: "#1a1d21",
		muted: "#5f6368",
		placeholder: "#5f6368",
		border: "#c4c7cc",
		primary: "#1565c0",
		primaryText: "#ffffff",
		danger: "#c5221f",
		success: "#1e7b34",
		warning: "#b4540a",
		chipBg: "#eef1f4",
	},
	dark: {
		bg: "#101418",
		surface: "#1a1f24",
		text: "#e3e6ea",
		muted: "#9aa3af",
		placeholder: "#9aa3af",
		border: "#3a424a",
		primary: "#8ab4f8",
		primaryText: "#101418",
		danger: "#f28b82",
		success: "#81c995",
		warning: "#ffb74d",
		chipBg: "#242b32",
	},
};

export const colors = palettes.light;
