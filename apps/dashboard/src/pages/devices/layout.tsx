import { navigate } from "@next/client";
import Box from "@shpaw415/mui-lite/Box";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useDashboardMode } from "../../hooks/useDashboardMode.tsx";
import { usePathname } from "../../hooks/usePathname.tsx";
import { isAdmin } from "../../lib/auth/role.ts";
import { deviceTabs } from "../../lib/dashboard-mode.ts";
import { isT3Path } from "../../lib/t3-url.ts";

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
	const { mode } = useDashboardMode();
	const onT3 = isT3Path(pathname);
	const tabs = deviceTabs(mode, isAdmin(session.data?.role));
	const value = active(pathname, tabs);

	return (
		<Box
			sx={{
				minWidth: 0,
				width: "100%",
				...(onT3
					? {
							display: "flex",
							flexDirection: "column",
							flex: 1,
							minHeight: 0,
							overflow: "hidden",
						}
					: undefined),
			}}
		>
			<Tabs
				value={value}
				onChange={(_event, next) => navigate(String(next))}
				variant="scrollable"
				aria-label="Devices sections"
				sx={{
					flex: "0 0 auto",
					height: "auto",
					flexShrink: 0,
					px: onT3 ? 1.5 : undefined,
				}}
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
								flex: 1,
								minHeight: 0,
								display: "flex",
								flexDirection: "column",
								overflow: "hidden",
							}
						: undefined
				}
			>
				{children}
			</Box>
		</Box>
	);
}
