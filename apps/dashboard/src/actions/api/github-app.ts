import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import {
	type GithubAppEnv,
	githubAppInstallUrl,
	githubAppStateKey,
	loadGithubAppInstall,
	readGithubInstallation,
	saveGithubAppInstall,
} from "../../lib/github-app.ts";
import { requireIdentity } from "../../lib/session.ts";

export const GET = wrapAction(async function GET() {
	const ctx = getContext<GithubAppEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const slug = ctx.env.GITHUB_APP_SLUG?.trim() ?? "";
	if (!slug || !ctx.env.GITHUB_APP_ID || !ctx.env.GITHUB_APP_PRIVATE_KEY) {
		throw new Error("github app is not configured");
	}
	const install = await loadGithubAppInstall(
		ctx.env.DYNAMIC_PAGE_KV,
		identity.id,
	);
	if (install) {
		return { connected: true as const, login: install.login, installUrl: "" };
	}
	const state = crypto.randomUUID();
	await ctx.env.DYNAMIC_PAGE_KV.put(githubAppStateKey(state), identity.id, {
		expirationTtl: 900,
	});
	return {
		connected: false as const,
		login: "",
		installUrl: githubAppInstallUrl(slug, state),
	};
});

export const POST = wrapAction(async function POST(input: {
	installationId: number | string;
	state: string;
}) {
	const ctx = getContext<GithubAppEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const state = input.state.trim();
	const expected = await ctx.env.DYNAMIC_PAGE_KV.get(githubAppStateKey(state));
	if (!state || expected !== identity.id) {
		throw new Error("github app state is invalid");
	}
	const installationId = Number(input.installationId);
	if (!Number.isFinite(installationId) || installationId <= 0) {
		throw new Error("installation id is required");
	}
	const info = await readGithubInstallation(ctx.env, installationId);
	await saveGithubAppInstall(ctx.env.DYNAMIC_PAGE_KV, identity.id, {
		installationId: info.id,
		login: info.login,
	});
	await ctx.env.DYNAMIC_PAGE_KV.delete(githubAppStateKey(state));
	return { connected: true as const, login: info.login };
});