import { Platform } from "react-native";

export const colors = {
	bg: Platform.OS === "ios" ? "#f2f2f7" : "#f5f6f8",
	surface: Platform.OS === "ios" ? "#ffffff" : "#ffffff",
	text: "#1a1d21",
	muted: "#5f6368",
	primary: Platform.OS === "ios" ? "#007aff" : "#1565c0",
	danger: "#c5221f",
};
