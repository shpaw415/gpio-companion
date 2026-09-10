import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import {
	completeGithubAppConnect,
	type GithubAppEnv,
	githubAppStatusForUser,
} from "../../lib/github-app.ts";
import { requireIdentity } from "../../lib/session.ts";

export const GET = wrapAction(async function GET() {
	const ctx = getContext<GithubAppEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	return githubAppStatusForUser(ctx.env, identity.id, ctx.request);
});

export const POST = wrapAction(async function POST(input: {
	installationId?: number | string;
	code?: string;
	state: string;
}) {
	const ctx = getContext<GithubAppEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	return completeGithubAppConnect(ctx.env, identity.id, input, ctx.request);
});
