import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import { creditsBalance, creditsView, grantUsd } from "../../lib/credits.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
};

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const micros = await creditsBalance(ctx.env.DYNAMIC_PAGE_KV, identity.id);
	return creditsView(micros);
});

export const POST = wrapAction(async function POST(usd = 1) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const grant = Number(usd);
	if (!Number.isFinite(grant) || grant <= 0) {
		throw new Error("amount must be positive");
	}
	const micros = await grantUsd(ctx.env.DYNAMIC_PAGE_KV, identity.id, grant);
	return creditsView(micros);
});
