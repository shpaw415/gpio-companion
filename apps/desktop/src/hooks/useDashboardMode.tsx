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
} from "../lib/dashboard-mode";

type Value = {
	mode: DashboardMode;
	setMode: (mode: DashboardMode) => void;
	toggleMode: () => void;
	isEasy: boolean;
};

const Ctx = createContext<Value | null>(null);

function readStoredMode(): DashboardMode {
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
		() => ({ mode, setMode, toggleMode, isEasy: mode === "easy" }),
		[mode, setMode, toggleMode],
	);
	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardMode(): Value {
	const ctx = useContext(Ctx);
	if (!ctx) {
		throw new Error("useDashboardMode requires DashboardModeProvider");
	}
	return ctx;
}
