import { getStarterKitSeed } from "./commerce/seed.ts";

export type DemoCatalogItem = {
	id: string;
	slug: string;
	sku: string;
	nameEn: string;
	nameFr: string;
	descriptionEn: string;
	descriptionFr: string;
	status: "draft" | "unpublished";
	priceCents: null;
	illustration: "starter" | "sensor" | "motion" | "maker";
};

const seed = getStarterKitSeed();

export const DEMO_CATALOG: readonly DemoCatalogItem[] = [
	{
		id: seed.product.slug,
		slug: seed.product.slug,
		sku: seed.product.sku,
		nameEn: seed.product.nameEn,
		nameFr: seed.product.nameFr,
		descriptionEn: seed.product.descriptionEn,
		descriptionFr: seed.product.descriptionFr,
		status: "draft",
		priceCents: null,
		illustration: "starter",
	},
	{
		id: "sensor-add-on",
		slug: "sensor-add-on",
		sku: "GPIO-SENSOR-ADD-ON",
		nameEn: "Sensor add-on",
		nameFr: "Module capteurs",
		descriptionEn: "Draft slot. Admin fills name, price, photos, stock.",
		descriptionFr: "Emplacement brouillon. L’admin complète le contenu.",
		status: "unpublished",
		priceCents: null,
		illustration: "sensor",
	},
	{
		id: "arduino-proxy-pack",
		slug: "arduino-proxy-pack",
		sku: "GPIO-PROXY-PACK",
		nameEn: "Arduino proxy pack",
		nameFr: "Pack proxy Arduino",
		descriptionEn: "Draft slot for the Firmata proxy bundle. No price invented.",
		descriptionFr: "Emplacement brouillon pour le pack proxy Firmata.",
		status: "unpublished",
		priceCents: null,
		illustration: "motion",
	},
];

export function getCatalogItem(id: string): DemoCatalogItem | undefined {
	return DEMO_CATALOG.find((item) => item.id === id);
}
