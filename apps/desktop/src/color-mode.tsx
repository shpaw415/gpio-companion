import { ThemeProvider } from "@shpaw415/mui-lite/theme";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useLayoutEffect,
	useMemo,
	useState,
} from "react";
import { type ColorMode, createAppTheme } from "./theme";

const STORAGE_KEY = "gpio-companion-color-mode";

type ColorModeContextValue = {
	mode: ColorMode;
	toggleMode: () => void;
	isDark: boolean;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function readStoredMode(): ColorMode {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored === "dark" || stored === "light") {
			return stored;
		}
	} catch {
		return "dark";
	}
	if (window.matchMedia?.("(prefers-color-scheme: light)").matches) {
		return "light";
	}
	return "dark";
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
	const [mode, setMode] = useState<ColorMode>(readStoredMode);
	const isDark = mode === "dark";
	const appTheme = useMemo(() => createAppTheme(mode), [mode]);

	useLayoutEffect(() => {
		document.documentElement.dataset.theme = mode;
		document.documentElement.style.colorScheme = mode;
		try {
			window.localStorage.setItem(STORAGE_KEY, mode);
		} catch {
			return;
		}
	}, [mode]);

	const toggleMode = useCallback(() => {
		setMode((current) => (current === "dark" ? "light" : "dark"));
	}, []);

	return (
		<ColorModeContext.Provider value={{ mode, toggleMode, isDark }}>
			<ThemeProvider theme={appTheme} WrapperElement="div">
				{children}
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
}

export function useColorMode() {
	const value = useContext(ColorModeContext);
	if (!value) {
		throw new Error("ColorModeProvider missing");
	}
	return value;
}
