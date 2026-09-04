"no action";

import {
	type GithubAppEnv,
	githubAppInstallUrl,
	githubAppStateKey,
	loadGithubAppInstall,
	readGithubInstallation,
	saveGithubAppInstall,
} from "../../../lib/github-app.ts";
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
		const pages = env(ctx);
		const slug = pages.GITHUB_APP_SLUG?.trim() ?? "";
		if (!slug || !pages.GITHUB_APP_ID || !pages.GITHUB_APP_PRIVATE_KEY) {
			throw new Error("github app is not configured");
		}
		const install = await loadGithubAppInstall(
			pages.DYNAMIC_PAGE_KV,
			identity.id,
		);
		if (install) {
			return { connected: true as const, login: install.login, installUrl: "" };
		}
		const state = crypto.randomUUID();
		await pages.DYNAMIC_PAGE_KV.put(githubAppStateKey(state), identity.id, {
			expirationTtl: 900,
		});
		return {
			connected: false as const,
			login: "",
			installUrl: githubAppInstallUrl(slug, state),
		};
	});
}

export async function onRequestPost(ctx: MobileContext) {
	return runMobile(ctx, async (identity) => {
		const pages = env(ctx);
		const body = await readJsonBody(ctx.request);
		const state = asString(body.state).trim();
		const expected = await pages.DYNAMIC_PAGE_KV.get(githubAppStateKey(state));
		if (!state || expected !== identity.id) {
			throw new Error("github app state is invalid");
		}
		const installationId = Number(body.installationId);
		if (!Number.isFinite(installationId) || installationId <= 0) {
			throw new Error("installation id is required");
		}
		const info = await readGithubInstallation(pages, installationId);
		await saveGithubAppInstall(pages.DYNAMIC_PAGE_KV, identity.id, {
			installationId: info.id,
			login: info.login,
		});
		await pages.DYNAMIC_PAGE_KV.delete(githubAppStateKey(state));
		return { connected: true as const, login: info.login };
	});
}
