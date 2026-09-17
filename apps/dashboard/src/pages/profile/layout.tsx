import { navigate } from "@next/client";
import Box from "@shpaw415/mui-lite/Box";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { useT } from "../../hooks/useLocale.tsx";
import { usePathname } from "../../hooks/usePathname.tsx";
import { PROFILE_TABS } from "../../lib/dashboard-mode.ts";

function active(pathname: string) {
	const match = [...PROFILE_TABS]
		.sort((a, b) => b.href.length - a.href.length)
		.find((tab) => pathname.startsWith(tab.href));
	return match?.href ?? "/profile";
}

export default function ProfileLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const pathname = usePathname();
	const t = useT();
	const value = active(pathname);

	return (
		<Box>
			<Tabs
				value={value}
				onChange={(_event, next) => navigate(String(next))}
				variant="scrollable"
				aria-label={t("nav.profileSections")}
			>
				{PROFILE_TABS.map((tab) => (
					<Tab key={tab.href} value={tab.href} label={t(tab.labelKey)} />
				))}
			</Tabs>
			<Box className="mt-1">{children}</Box>
		</Box>
	);
}
