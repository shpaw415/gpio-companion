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
import { type ColorMode, createAppTheme } from "../lib/theme.ts";

export const COLOR_MODE_STORAGE_KEY = "gpio-companion-color-mode";

type ColorModeContextValue = {
	mode: ColorMode;
	setMode: (mode: ColorMode) => void;
	toggleMode: () => void;
	isDark: boolean;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function readStoredMode(): ColorMode {
	if (typeof window === "undefined") {
		return "dark";
	}
	try {
		const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
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

function getInitialMode(): ColorMode {
	if (typeof document !== "undefined") {
		const fromDom = document.documentElement.dataset.theme;
		if (fromDom === "dark" || fromDom === "light") {
			return fromDom;
		}
	}
	if (typeof window !== "undefined") {
		return readStoredMode();
	}
	return "dark";
}

function applyDocumentMode(mode: ColorMode) {
	if (typeof document === "undefined") {
		return;
	}
	const root = document.documentElement;
	root.dataset.theme = mode;
	root.style.colorScheme = mode;
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<ColorMode>(getInitialMode);

	useLayoutEffect(() => {
		applyDocumentMode(mode);
	}, [mode]);

	const setMode = useCallback((next: ColorMode) => {
		setModeState(next);
		applyDocumentMode(next);
		try {
			window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
		} catch {
			return;
		}
	}, []);

	const toggleMode = useCallback(() => {
		setMode(mode === "dark" ? "light" : "dark");
	}, [mode, setMode]);

	const appTheme = useMemo(() => createAppTheme(mode), [mode]);

	const value = useMemo(
		() => ({
			mode,
			setMode,
			toggleMode,
			isDark: mode === "dark",
		}),
		[mode, setMode, toggleMode],
	);

	return (
		<ColorModeContext.Provider value={value}>
			<ThemeProvider theme={appTheme} WrapperElement="div">
				{children}
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
}

export function useColorMode(): ColorModeContextValue {
	const ctx = useContext(ColorModeContext);
	if (!ctx) {
		throw new Error("useColorMode must be used within ColorModeProvider");
	}
	return ctx;
}
