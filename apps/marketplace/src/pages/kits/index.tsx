import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { GET } from "../../actions/api/catalog.ts";
import CatalogGrid from "../../components/CatalogGrid.tsx";
import { useT } from "../../hooks/useLocale.tsx";
import type { PublicCatalogProduct } from "../../lib/commerce/catalog-repository.ts";

export default function KitsPage() {
	const t = useT();
	const [items, setItems] = useState<PublicCatalogProduct[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		GET()
			.then(setItems)
			.catch(() => setItems([]))
			.finally(() => setLoading(false));
	}, []);

	return (
		<div>
			<Typography variant="h3" component="h1">
				{t("catalog.title")}
			</Typography>
			<Typography color="textSecondary">{t("catalog.emptyBody")}</Typography>
			<CatalogGrid items={items} loading={loading} />
		</div>
	);
}
