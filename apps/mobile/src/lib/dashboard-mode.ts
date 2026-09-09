export type DashboardMode = "easy" | "expert";

export const DASHBOARD_MODE_STORAGE_KEY = "gpio-companion-dashboard-mode";

export type DeviceTabId =
	| "overview"
	| "docs"
	| "t3"
	| "pair"
	| "wifi"
	| "requests"
	| "debug"
	| "admin";

export const DEVICE_TABS_EASY: Array<{ id: DeviceTabId; label: string }> = [
	{ id: "overview", label: "My board" },
	{ id: "wifi", label: "WiFi" },
	{ id: "t3", label: "Code" },
	{ id: "docs", label: "Learn" },
];

export const DEVICE_TABS_EXPERT: Array<{ id: DeviceTabId; label: string }> = [
	{ id: "overview", label: "My board" },
	{ id: "docs", label: "Learn" },
	{ id: "t3", label: "Code" },
	{ id: "pair", label: "Pair" },
	{ id: "wifi", label: "WiFi" },
	{ id: "requests", label: "Requests" },
	{ id: "debug", label: "Debug" },
];

export function parseDashboardMode(
	value: string | null | undefined,
): DashboardMode {
	return value === "expert" ? "expert" : "easy";
}

export function deviceTabs(
	mode: DashboardMode,
	admin: boolean,
): Array<{ id: DeviceTabId; label: string }> {
	const tabs = mode === "easy" ? DEVICE_TABS_EASY : DEVICE_TABS_EXPERT;
	if (mode === "expert" && admin) {
		return [...tabs, { id: "admin", label: "Admin" }];
	}
	return tabs;
}

export function isAllowedDeviceTab(
	mode: DashboardMode,
	admin: boolean,
	tab: DeviceTabId,
): boolean {
	if (tab === "pair") {
		return true;
	}
	return deviceTabs(mode, admin).some((item) => item.id === tab);
}
