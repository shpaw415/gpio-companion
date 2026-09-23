import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { navigate } from "frame-master-plugin-apply-react/utils";
import AppHeader from "../components/AppHeader.tsx";
import Footer from "../components/Footer.tsx";
import MarketplaceProviders from "../components/MarketplaceProviders.tsx";
import { useT } from "../hooks/useLocale.tsx";
import { usePath } from "../hooks/usePath.ts";

function DenseTabs({ activePath }: { activePath: string }) {
	const t = useT();
	const tabs = [
		{ value: "/", label: t("nav.home") },
		{ value: "/kits", label: t("nav.kits") },
		{ value: "/cart", label: t("nav.cart") },
		{ value: "/orders", label: t("nav.orders") },
		{ value: "/admin", label: t("admin.overview") },
	];
	const value = tabs.some((tab) => tab.value === activePath)
		? activePath
		: activePath.startsWith("/kits")
			? "/kits"
			: activePath.startsWith("/cart") || activePath.startsWith("/checkout")
				? "/cart"
				: activePath.startsWith("/admin")
					? "/admin"
					: "/";
	return (
		<div className="market-dense-tabs">
			<Tabs
				value={value}
				variant="scrollable"
				aria-label={t("nav.label")}
				onChange={(_, next) => {
					navigate(String(next));
				}}
			>
				{tabs.map((tab) => (
					<Tab key={tab.value} value={tab.value} label={tab.label} />
				))}
			</Tabs>
		</div>
	);
}

function Chrome({ children }: { children: React.JSX.Element }) {
	const activePath = usePath() ?? "/";
	return (
		<div className="min-h-screen market-theme-root">
			<AppHeader activePath={activePath} />
			<DenseTabs activePath={activePath} />
			<main className="market-dense-main">{children}</main>
			<Footer />
		</div>
	);
}

export default function Layout({ children }: { children: React.JSX.Element }) {
	return (
		<MarketplaceProviders>
			<Chrome>{children}</Chrome>
		</MarketplaceProviders>
	);
}
