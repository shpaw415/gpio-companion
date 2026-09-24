import { getContext } from "@next/action/context";
import { commerceDb } from "../../lib/admin-auth.ts";
import {
	getPublishedPolicyBySlug,
	listPublishedPolicies,
} from "../../lib/commerce/catalog-repository.ts";

export async function GET() {
	const ctx = getContext<Env, never, never>(arguments);
	return listPublishedPolicies(commerceDb(ctx));
}

export async function POST(slug: string) {
	const ctx = getContext<Env, never, never>(arguments);
	return getPublishedPolicyBySlug(commerceDb(ctx), slug);
}
