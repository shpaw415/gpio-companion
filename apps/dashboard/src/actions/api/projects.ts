import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import {
	githubConfigured,
	listRepos,
	loadGithubAccount,
	loadProjectBundle,
	readRepoFile,
} from "../../lib/github.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
};

async function accountForUser(env: PagesEnv, userId: string) {
	return loadGithubAccount(env.DYNAMIC_PAGE_KV, userId);
}

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const account = await accountForUser(ctx.env, identity.id);
	if (!githubConfigured(account)) {
		return {
			configured: false,
			repos: [] as Awaited<ReturnType<typeof listRepos>>,
		};
	}
	return { configured: true, repos: await listRepos(account) };
});

export const POST = wrapAction(async function POST(owner: string, repo: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const account = await accountForUser(ctx.env, identity.id);
	if (!githubConfigured(account)) {
		throw new Error("github is not configured");
	}
	return loadProjectBundle(account, owner, repo);
});

export const PUT = wrapAction(async function PUT(
	owner: string,
	repo: string,
	path: string,
) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const account = await accountForUser(ctx.env, identity.id);
	if (!githubConfigured(account)) {
		throw new Error("github is not configured");
	}
	return { text: await readRepoFile(account, owner, repo, path) };
});
