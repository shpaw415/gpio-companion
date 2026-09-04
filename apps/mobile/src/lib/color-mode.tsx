import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import { storageGet, storageSet } from "./storage.ts";
import { type ColorMode, type Colors, palettes } from "./theme.ts";

const STORAGE_KEY = "gpio-companion-color-mode";

type ColorModeContextValue = {
	mode: ColorMode;
	toggleMode: () => void;
	isDark: boolean;
	colors: Colors;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

export function ColorModeProvider({ children }: { children: ReactNode }) {
	const system = useColorScheme();
	const [mode, setMode] = useState<ColorMode>(
		system === "light" ? "light" : "dark",
	);

	useEffect(() => {
		void storageGet(STORAGE_KEY).then((stored) => {
			if (stored === "dark" || stored === "light") {
				setMode(stored);
			}
		});
	}, []);

	useEffect(() => {
		void storageSet(STORAGE_KEY, mode);
	}, [mode]);

	const toggleMode = useCallback(() => {
		setMode((current) => (current === "dark" ? "light" : "dark"));
	}, []);

	const value = useMemo(
		() => ({
			mode,
			toggleMode,
			isDark: mode === "dark",
			colors: palettes[mode],
		}),
		[mode, toggleMode],
	);

	return (
		<ColorModeContext.Provider value={value}>
			{children}
		</ColorModeContext.Provider>
	);
}

export function useColorMode() {
	const value = useContext(ColorModeContext);
	if (!value) {
		const system = Appearance.getColorScheme() === "light" ? "light" : "dark";
		return {
			mode: system as ColorMode,
			toggleMode: () => undefined,
			isDark: system === "dark",
			colors: palettes[system],
		};
	}
	return value;
}

export function useColors(): Colors {
	return useColorMode().colors;
}
