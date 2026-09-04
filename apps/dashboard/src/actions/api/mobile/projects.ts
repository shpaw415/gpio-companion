"no action";

import type { GithubAppEnv } from "../../../lib/github-app.ts";
import {
	githubAccountForUser,
	githubConfigured,
	listRepos,
	loadProjectBundle,
	readRepoFile,
} from "../../../lib/github.ts";
import {
	asString,
	type MobileContext,
	readJsonBody,
	runMobile,
} from "../../../lib/mobile-http.ts";

function env(ctx: MobileContext): GithubAppEnv {
	return ctx.env as GithubAppEnv;
}

export async function onRequestGet(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const account = await githubAccountForUser(env(ctx), identity.id);
		if (!githubConfigured(account)) {
			return { configured: false, repos: [] };
		}
		return { configured: true, repos: await listRepos(account) };
	});
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const owner = asString(body.owner).trim();
		const repo = asString(body.repo).trim();
		if (!owner || !repo) {
			throw new Error("owner and repo are required");
		}
		const account = await githubAccountForUser(env(ctx), identity.id);
		if (!githubConfigured(account)) {
			throw new Error("github is not configured");
		}
		return loadProjectBundle(account, owner, repo);
	});
}

export async function onRequestPut(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const body = await readJsonBody(ctx.request);
		const owner = asString(body.owner).trim();
		const repo = asString(body.repo).trim();
		const path = asString(body.path).trim();
		if (!owner || !repo || !path) {
			throw new Error("owner, repo, and path are required");
		}
		const account = await githubAccountForUser(env(ctx), identity.id);
		if (!githubConfigured(account)) {
			throw new Error("github is not configured");
		}
		return { text: await readRepoFile(account, owner, repo, path) };
	});
}
