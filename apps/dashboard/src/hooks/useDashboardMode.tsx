import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import {
	DASHBOARD_MODE_STORAGE_KEY,
	type DashboardMode,
	parseDashboardMode,
} from "../lib/dashboard-mode.ts";

type DashboardModeContextValue = {
	mode: DashboardMode;
	setMode: (mode: DashboardMode) => void;
	toggleMode: () => void;
	isEasy: boolean;
};

const DashboardModeContext = createContext<DashboardModeContextValue | null>(
	null,
);

function readStoredMode(): DashboardMode {
	if (typeof window === "undefined") {
		return "easy";
	}
	try {
		return parseDashboardMode(
			window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY),
		);
	} catch {
		return "easy";
	}
}

export function DashboardModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<DashboardMode>(readStoredMode);

	const setMode = useCallback((next: DashboardMode) => {
		setModeState(next);
		try {
			window.localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, next);
		} catch {
			return;
		}
	}, []);

	const toggleMode = useCallback(() => {
		setMode(mode === "easy" ? "expert" : "easy");
	}, [mode, setMode]);

	const value = useMemo(
		() => ({
			mode,
			setMode,
			toggleMode,
			isEasy: mode === "easy",
		}),
		[mode, setMode, toggleMode],
	);

	return (
		<DashboardModeContext.Provider value={value}>
			{children}
		</DashboardModeContext.Provider>
	);
}

export function useDashboardMode(): DashboardModeContextValue {
	const ctx = useContext(DashboardModeContext);
	if (!ctx) {
		throw new Error(
			"useDashboardMode must be used within DashboardModeProvider",
		);
	}
	return ctx;
}
