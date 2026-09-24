import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { GET } from "../actions/api/catalog.ts";
import CatalogGrid from "../components/CatalogGrid.tsx";
import PageHero from "../components/PageHero.tsx";
import { useT } from "../hooks/useLocale.tsx";
import type { PublicCatalogProduct } from "../lib/commerce/catalog-repository.ts";

const POINTS = [
	["home.agent", "home.agentBody"],
	["home.circuits", "home.circuitsBody"],
	["home.github", "home.githubBody"],
	["home.gpio", "home.gpioBody"],
	["home.arduino", "home.arduinoBody"],
] as const;

export default function HomePage() {
	const t = useT();
	const [items, setItems] = useState<PublicCatalogProduct[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		GET()
			.then((rows) => setItems(rows.slice(0, 3)))
			.catch(() => setItems([]))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div>
			<PageHero
				title={t("home.title")}
				description={t("home.subtitle")}
				actions={
					<Button href="/kits" variant="contained">
						{t("home.browse")}
					</Button>
				}
			/>
			<section>
				<Typography variant="h5" component="h2">
					{t("home.pointsTitle")}
				</Typography>
				<div className="market-points">
					{POINTS.map(([title, body]) => (
						<Paper key={title} variant="outlined" className="market-point">
							<Typography variant="h6" component="h3">
								{t(title)}
							</Typography>
							<Typography color="textSecondary">{t(body)}</Typography>
						</Paper>
					))}
				</div>
			</section>
			<section>
				<Typography variant="h5" component="h2">
					{t("home.featured")}
				</Typography>
				{!loading && items.length === 0 ? (
					<Typography color="textSecondary">{t("home.empty")}</Typography>
				) : (
					<CatalogGrid items={items} loading={loading} />
				)}
			</section>
		</div>
	);
}
