import { getContext } from "@next/action/context";
import { commerceDb, requireAdmin } from "../../../lib/admin-auth.ts";
import {
	createPolicy,
	createProduct,
	listAdminProducts,
	listPolicies,
} from "../../../lib/commerce/admin-repository.ts";
import { getStarterKitSeed } from "../../../lib/commerce/seed.ts";

/**
 * One-shot dev seed: starter-kit draft product + five policy drafts.
 * Skips anything whose slug already exists. Never invents price or stock.
 */
export async function POST() {
	const ctx = getContext<Env, never, never>(arguments);
	const db = commerceDb(ctx);
	const [products, policies] = await Promise.all([
		listAdminProducts(db),
		listPolicies(db),
	]);
	const slugs = new Set(products.map((product) => product.slug));
	const policySlugs = new Set(policies.map((policy) => policy.slug));
	const created: { products: number; policies: number } = {
		products: 0,
		policies: 0,
	};

	const seed = getStarterKitSeed();
	if (!slugs.has(seed.product.slug)) {
		await createProduct(db, {
			slug: seed.product.slug,
			sku: seed.product.sku,
			nameEn: seed.product.nameEn,
			nameFr: seed.product.nameFr,
			descriptionEn: seed.product.descriptionEn,
			descriptionFr: seed.product.descriptionFr,
			priceCents: null,
		});
		created.products += 1;
	}

	const drafts = [
		{
			slug: "privacy",
			titleEn: "Privacy policy",
			titleFr: "Politique de confidentialité",
		},
		{
			slug: "terms-of-sale",
			titleEn: "Terms of sale",
			titleFr: "Conditions de vente",
		},
		{
			slug: "shipping",
			titleEn: "Shipping policy",
			titleFr: "Politique de livraison",
		},
		{
			slug: "returns-refunds",
			titleEn: "Returns & refunds",
			titleFr: "Retours & remboursements",
		},
		{
			slug: "hardware-safety-warranty",
			titleEn: "Hardware safety & warranty",
			titleFr: "Sécurité matérielle & garantie",
		},
	];
	for (const draft of drafts) {
		if (policySlugs.has(draft.slug)) continue;
		await createPolicy(db, {
			...draft,
			bodyEn: "",
			bodyFr: "",
		});
		created.policies += 1;
	}
	return created;
}
