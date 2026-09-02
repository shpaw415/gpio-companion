import { navigate } from "@next/client";
import Box from "@shpaw415/mui-lite/Box";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { isAdmin } from "../../lib/auth/role.ts";

const baseTabs = [
	{ href: "/devices", label: "Overview" },
	{ href: "/devices/pair", label: "Pair" },
	{ href: "/devices/wifi", label: "WiFi" },
	{ href: "/devices/keys", label: "Keys" },
	{ href: "/devices/notifications", label: "Requests" },
	{ href: "/devices/debug", label: "Debug" },
];

const adminTab = { href: "/devices/admin", label: "Admin" };

function active(pathname: string, tabs: Array<{ href: string }>) {
	const match = [...tabs]
		.sort((a, b) => b.href.length - a.href.length)
		.find((tab) => pathname.startsWith(tab.href));
	return match?.href ?? "/devices";
}

export default function DevicesLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const session = useAuthSession();
	const tabs = isAdmin(session.data?.role) ? [...baseTabs, adminTab] : baseTabs;
	const value =
		typeof window === "undefined"
			? "/devices"
			: active(window.location.pathname, tabs);

	return (
		<Box>
			<Tabs
				value={value}
				onChange={(_event, next) => navigate(String(next))}
				variant="scrollable"
				aria-label="Devices sections"
			>
				{tabs.map((tab) => (
					<Tab key={tab.href} value={tab.href} label={tab.label} />
				))}
			</Tabs>
			<Box className="mt-6">{children}</Box>
		</Box>
	);
}
