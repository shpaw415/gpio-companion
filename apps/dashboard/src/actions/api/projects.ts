import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import {
	giteaConfigured,
	listRepos,
	loadProjectBundle,
	readRepoFile,
} from "../../lib/gitea.ts";

type PagesEnv = {
	GITEA_URL?: string;
	GITEA_TOKEN?: string;
};

export async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const env = {
		GITEA_URL: ctx.env.GITEA_URL,
		GITEA_TOKEN: ctx.env.GITEA_TOKEN,
	};
	if (!giteaConfigured(env)) {
		return {
			configured: false,
			repos: [] as Awaited<ReturnType<typeof listRepos>>,
		};
	}
	return { configured: true, repos: await listRepos(env) };
}

export async function POST(owner: string, repo: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const env = {
		GITEA_URL: ctx.env.GITEA_URL,
		GITEA_TOKEN: ctx.env.GITEA_TOKEN,
	};
	if (!giteaConfigured(env)) {
		throw new Error("gitea is not configured");
	}
	return loadProjectBundle(env, owner, repo);
}

export async function PUT(owner: string, repo: string, path: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const env = {
		GITEA_URL: ctx.env.GITEA_URL,
		GITEA_TOKEN: ctx.env.GITEA_TOKEN,
	};
	if (!giteaConfigured(env)) {
		throw new Error("gitea is not configured");
	}
	return { text: await readRepoFile(env, owner, repo, path) };
}
