import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	DASHBOARD_MODE_STORAGE_KEY,
	type DashboardMode,
	parseDashboardMode,
} from "./dashboard-mode.ts";
import { storageGet, storageSet } from "./storage.ts";

type Value = {
	mode: DashboardMode;
	setMode: (mode: DashboardMode) => void;
	toggleMode: () => void;
	isEasy: boolean;
};

const Ctx = createContext<Value | null>(null);

export function DashboardModeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<DashboardMode>("easy");

	useEffect(() => {
		void storageGet(DASHBOARD_MODE_STORAGE_KEY).then((stored) => {
			setModeState(parseDashboardMode(stored));
		});
	}, []);

	const setMode = useCallback((next: DashboardMode) => {
		setModeState(next);
		void storageSet(DASHBOARD_MODE_STORAGE_KEY, next);
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
