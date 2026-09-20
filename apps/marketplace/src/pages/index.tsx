<<<<<<< HEAD
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import CatalogTable from "../components/CatalogTable.tsx";
import { useT } from "../hooks/useLocale.tsx";
import { DEMO_CATALOG } from "../lib/demo-catalog.ts";

export default function HomePage() {
	const t = useT();
	return (
		<div>
			<Paper
				className="market-page-hero is-compact circuit-grid"
				variant="outlined"
			>
				<div className="market-page-hero-copy">
					<Typography variant="h3" component="h1">
						{t("catalog.title")}
					</Typography>
					<Typography color="textSecondary">
						{t("brand.tagline")} {t("catalog.subtitle")}
					</Typography>
				</div>
			</Paper>
			<CatalogTable items={DEMO_CATALOG} />
		</div>
	);
=======
export default function IndexPage() {
	return <h1>Welcome to the Marketplace</h1>;
>>>>>>> origin/feature/new-ui
}
