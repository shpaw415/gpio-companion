import { getContext } from "@next/action/context";
import { commerceDb } from "../../lib/admin-auth.ts";
import { listPublishedProducts } from "../../lib/commerce/catalog-repository.ts";

export async function GET() {
	const ctx = getContext<Env, never, never>(arguments);
	return listPublishedProducts(commerceDb(ctx));
}
