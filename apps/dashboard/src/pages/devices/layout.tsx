import { navigate } from "@next/client";
import Box from "@shpaw415/mui-lite/Box";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { usePathname } from "../../hooks/usePathname.tsx";
import { isAdmin } from "../../lib/auth/role.ts";
import { isT3Path } from "../../lib/t3-url.ts";

const baseTabs = [
	{ href: "/devices", label: "Overview" },
	{ href: "/devices/docs", label: "Docs" },
	{ href: "/devices/t3", label: "T3" },
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
	const pathname = usePathname();
	const onT3 = isT3Path(pathname);
	const tabs = isAdmin(session.data?.role) ? [...baseTabs, adminTab] : baseTabs;
	const value = active(pathname, tabs);

	return (
		<Box
			sx={{
				minWidth: 0,
				width: "100%",
				...(onT3
					? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }
					: undefined),
			}}
		>
			<Tabs
				value={value}
				onChange={(_event, next) => navigate(String(next))}
				variant="scrollable"
				aria-label="Devices sections"
				sx={{ flex: "0 0 auto", height: "auto", flexShrink: 0 }}
			>
				{tabs.map((tab) => (
					<Tab key={tab.href} value={tab.href} label={tab.label} />
				))}
			</Tabs>
			<Box
				className={onT3 ? undefined : "mt-3 min-[900px]:mt-6"}
				sx={
					onT3
						? {
								mt: 1,
								flex: 1,
								minHeight: 0,
								display: "flex",
								flexDirection: "column",
							}
						: undefined
				}
			>
				{children}
			</Box>
		</Box>
	);
}
