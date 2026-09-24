import { getContext } from "@next/action/context";
import { commerceDb } from "../../lib/admin-auth.ts";
import { getPublishedProductBySlug } from "../../lib/commerce/catalog-repository.ts";

export async function GET(slug: string) {
	const ctx = getContext<Env, never, never>(arguments);
	return getPublishedProductBySlug(commerceDb(ctx), slug);
}
