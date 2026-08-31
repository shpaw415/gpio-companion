import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import { creditsBalance, grantCredits } from "../../lib/credits.ts";
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
	const balance = await creditsBalance(ctx.env.DYNAMIC_PAGE_KV, identity.id);
	return { balance };
});

export const POST = wrapAction(async function POST(amount = 100) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const grant = Number(amount);
	if (!Number.isFinite(grant) || grant <= 0) {
		throw new Error("amount must be positive");
	}
	const balance = await grantCredits(
		ctx.env.DYNAMIC_PAGE_KV,
		identity.id,
		Math.floor(grant),
	);
	return { balance };
});
