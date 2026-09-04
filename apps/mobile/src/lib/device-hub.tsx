import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

export type DeviceTab =
	| "overview"
	| "docs"
	| "t3"
	| "pair"
	| "wifi"
	| "keys"
	| "requests"
	| "debug"
	| "admin";

type DeviceHubValue = {
	tab: DeviceTab;
	setTab: (tab: DeviceTab) => void;
};

const DeviceHubCtx = createContext<DeviceHubValue | null>(null);

export function DeviceHubProvider({ children }: { children: ReactNode }) {
	const [tab, setTabState] = useState<DeviceTab>("overview");
	const setTab = useCallback((next: DeviceTab) => {
		setTabState(next);
	}, []);
	const value = useMemo(() => ({ tab, setTab }), [tab, setTab]);
	return (
		<DeviceHubCtx.Provider value={value}>{children}</DeviceHubCtx.Provider>
	);
}

export function useDeviceHub(): DeviceHubValue {
	const ctx = useContext(DeviceHubCtx);
	if (!ctx) {
		return { tab: "overview", setTab: () => undefined };
	}
	return ctx;
}
