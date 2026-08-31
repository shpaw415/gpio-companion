import Box from "@shpaw415/mui-lite/Box";
import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { navigate } from "@next/client";

const tabs = [
	{ href: "/profile", label: "Account" },
	{ href: "/profile/credits", label: "Credits" },
];

function active(pathname: string) {
	const match = [...tabs]
		.sort((a, b) => b.href.length - a.href.length)
		.find((tab) => pathname.startsWith(tab.href));
	return match?.href ?? "/profile";
}

export default function ProfileLayout({
	children,
}: {
	children: React.JSX.Element;
}) {
	const value =
		typeof window === "undefined"
			? "/profile"
			: active(window.location.pathname);

	return (
		<Box>
			<Tabs
				value={value}
				onChange={(_event, next) => navigate(String(next))}
				aria-label="Profile sections"
			>
				{tabs.map((tab) => (
					<Tab key={tab.href} value={tab.href} label={tab.label} />
				))}
			</Tabs>
			<Box className="mt-6">{children}</Box>
		</Box>
	);
}