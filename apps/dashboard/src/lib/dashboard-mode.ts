export type DashboardMode = "easy" | "expert";

export const DASHBOARD_MODE_STORAGE_KEY = "gpio-companion-dashboard-mode";

export type SectionTab = {
	href: string;
	label: string;
};

export const DEVICE_TABS_EASY: SectionTab[] = [
	{ href: "/devices", label: "My board" },
	{ href: "/devices/wifi", label: "WiFi" },
	{ href: "/devices/t3", label: "Code" },
	{ href: "/devices/docs", label: "Learn" },
];

export const DEVICE_TABS_EXPERT: SectionTab[] = [
	{ href: "/devices", label: "My board" },
	{ href: "/devices/docs", label: "Learn" },
	{ href: "/devices/t3", label: "Code" },
	{ href: "/devices/pair", label: "Pair" },
	{ href: "/devices/wifi", label: "WiFi" },
	{ href: "/devices/notifications", label: "Requests" },
	{ href: "/devices/debug", label: "Debug" },
];

export const DEVICE_TAB_ADMIN: SectionTab = {
	href: "/devices/admin",
	label: "Admin",
};

export const PROFILE_TABS: SectionTab[] = [
	{ href: "/profile", label: "Account" },
	{ href: "/profile/github", label: "GitHub" },
	{ href: "/profile/credits", label: "Credits" },
];

const EXPERT_ONLY_PATHS = ["/devices/debug", "/devices/admin"] as const;

export function parseDashboardMode(
	value: string | null | undefined,
): DashboardMode {
	return value === "expert" ? "expert" : "easy";
}

export function deviceTabs(mode: DashboardMode, admin: boolean): SectionTab[] {
	const tabs = mode === "easy" ? DEVICE_TABS_EASY : DEVICE_TABS_EXPERT;
	if (mode === "expert" && admin) {
		return [...tabs, DEVICE_TAB_ADMIN];
	}
	return tabs;
}

export function isExpertOnlyPath(pathname: string): boolean {
	return EXPERT_ONLY_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	);
}

export function withSearch(path: string, search: string): string {
	if (!search || search === "?") {
		return path;
	}
	return `${path}${search.startsWith("?") ? search : `?${search}`}`;
}
