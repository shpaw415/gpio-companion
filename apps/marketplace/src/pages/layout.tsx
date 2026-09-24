import AppHeader from "../components/AppHeader.tsx";
import CookieBanner from "../components/CookieBanner.tsx";
import Footer from "../components/Footer.tsx";
import MarketplaceProviders from "../components/MarketplaceProviders.tsx";
import { usePath } from "../hooks/usePath.ts";

function Chrome({ children }: { children: React.JSX.Element }) {
	const activePath = usePath() ?? "/";
	const admin = activePath.startsWith("/admin");
	return (
		<div className="min-h-screen market-theme-root">
			<AppHeader activePath={activePath} />
			<main className="market-dense-main">{children}</main>
			<Footer />
			{admin ? null : <CookieBanner />}
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
