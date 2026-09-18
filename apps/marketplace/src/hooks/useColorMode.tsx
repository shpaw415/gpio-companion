import { ThemeProvider } from "@shpaw415/mui-lite/theme";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { type ColorMode, createMarketplaceTheme } from "../lib/theme.ts";

export const COLOR_MODE_STORAGE_KEY = "gpio-companion-color-mode";

type ColorModeContextValue = {
	mode: ColorMode;
	isDark: boolean;
	setMode: (mode: ColorMode) => void;
	toggleMode: () => void;
};

const ColorModeContext = createContext<ColorModeContextValue | null>(null);

function applyMode(mode: ColorMode) {
	if (typeof document === "undefined") return;
	document.documentElement.dataset.theme = mode;
	document.documentElement.style.colorScheme = mode;
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<ColorMode>("light");

	useEffect(() => {
		let next: ColorMode = window.matchMedia?.("(prefers-color-scheme: dark)")
			.matches
			? "dark"
			: "light";
		try {
			const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);
			if (stored === "light" || stored === "dark") next = stored;
		} catch {
			// System preference is a safe fallback.
		}
		setModeState(next);
		applyMode(next);
	}, []);

	useEffect(() => applyMode(mode), [mode]);

	function setMode(next: ColorMode) {
		setModeState(next);
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, next);
		} catch {
			// The selected mode still applies for this render session.
		}
	}

	return (
		<ColorModeContext.Provider
			value={{
				mode,
				isDark: mode === "dark",
				setMode,
				toggleMode: () => setMode(mode === "dark" ? "light" : "dark"),
			}}
		>
			<ThemeProvider
				theme={createMarketplaceTheme(mode)}
				WrapperElement="div"
				className="market-theme-root"
			>
				{children}
			</ThemeProvider>
		</ColorModeContext.Provider>
	);
}

export function useColorMode(): ColorModeContextValue {
	const value = useContext(ColorModeContext);
	if (!value) {
		throw new Error("useColorMode must be used within ColorModeProvider");
	}
	return value;
}
