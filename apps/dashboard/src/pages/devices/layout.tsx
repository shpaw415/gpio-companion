import Box from "@shpaw415/mui-lite/Box";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { navigate } from "@next/client";

const tabs = [
	{ href: "/devices", label: "Overview" },
	{ href: "/devices/pair", label: "Pair" },
	{ href: "/devices/wifi", label: "WiFi" },
	{ href: "/devices/keys", label: "Keys" },
	{ href: "/devices/notifications", label: "Requests" },
];

function active(pathname: string) {
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
	const value =
		typeof window === "undefined"
			? "/devices"
			: active(window.location.pathname);

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