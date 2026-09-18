import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client";
import {
	inventory,
	inventoryReservations,
	policies,
	productImages,
	products,
} from "../db/schema";
import { availableInventory } from "./totals";

export interface PublicCatalogProduct {
	id: string;
	slug: string;
	sku: string;
	nameEn: string;
	nameFr: string;
	descriptionEn: string;
	descriptionFr: string;
	priceCents: number;
	currency: "USD";
	available: number;
	images: Array<{
		id: string;
		r2Key: string;
		altEn: string;
		altFr: string;
		sortOrder: number;
	}>;
}

const publicProductSelection = {
	id: products.id,
	slug: products.slug,
	sku: products.sku,
	nameEn: products.nameEn,
	nameFr: products.nameFr,
	descriptionEn: products.descriptionEn,
	descriptionFr: products.descriptionFr,
	priceCents: products.priceCents,
	onHand: inventory.onHand,
	reserved: sql<number>`coalesce((select sum(${inventoryReservations.quantity}) from ${inventoryReservations} where ${inventoryReservations.productId} = ${products.id} and ${inventoryReservations.status} = 'active' and ${inventoryReservations.expiresAt} > unixepoch()), 0)`,
};

interface PublicProductRow {
	id: string;
	slug: string;
	sku: string;
	nameEn: string;
	nameFr: string;
	descriptionEn: string;
	descriptionFr: string;
	priceCents: number | null;
	onHand: number;
	reserved: number;
}

async function attachImages(
	db: CommerceDatabase,
	rows: PublicProductRow[],
): Promise<PublicCatalogProduct[]> {
	if (rows.length === 0) return [];
	const images = await db
		.select({
			id: productImages.id,
			productId: productImages.productId,
			r2Key: productImages.r2Key,
			altEn: productImages.altEn,
			altFr: productImages.altFr,
			sortOrder: productImages.sortOrder,
		})
		.from(productImages)
		.where(
			inArray(
				productImages.productId,
				rows.map((row) => row.id),
			),
		)
		.orderBy(asc(productImages.sortOrder), asc(productImages.id));

	return rows.flatMap((row) => {
		if (row.priceCents === null) return [];
		return [
			{
				id: row.id,
				slug: row.slug,
				sku: row.sku,
				nameEn: row.nameEn,
				nameFr: row.nameFr,
				descriptionEn: row.descriptionEn,
				descriptionFr: row.descriptionFr,
				priceCents: row.priceCents,
				currency: "USD" as const,
				available: availableInventory(row.onHand, row.reserved),
				images: images
					.filter((image) => image.productId === row.id)
					.map(({ productId: _productId, ...image }) => image),
			},
		];
	});
}

export async function listPublishedProducts(
	db: CommerceDatabase,
): Promise<PublicCatalogProduct[]> {
	const rows = await db
		.select(publicProductSelection)
		.from(products)
		.innerJoin(inventory, eq(inventory.productId, products.id))
		.where(eq(products.status, "published"))
		.orderBy(asc(products.nameEn), asc(products.id));
	return attachImages(db, rows);
}

export async function getPublishedProductBySlug(
	db: CommerceDatabase,
	slug: string,
): Promise<PublicCatalogProduct | null> {
	const rows = await db
		.select(publicProductSelection)
		.from(products)
		.innerJoin(inventory, eq(inventory.productId, products.id))
		.where(and(eq(products.status, "published"), eq(products.slug, slug)))
		.limit(1);
	return (await attachImages(db, rows))[0] ?? null;
}

export async function listPublishedPolicies(db: CommerceDatabase) {
	return db
		.select()
		.from(policies)
		.where(eq(policies.status, "published"))
		.orderBy(asc(policies.slug));
}

export async function getPublishedPolicyBySlug(
	db: CommerceDatabase,
	slug: string,
) {
	const [policy] = await db
		.select()
		.from(policies)
		.where(and(eq(policies.status, "published"), eq(policies.slug, slug)))
		.limit(1);
	return policy ?? null;
}
