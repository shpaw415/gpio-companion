import {
	BREADBOARD_CIRCUIT_JSON,
	BREADBOARD_DIAGRAM_JSON,
	BREADBOARD_PREVIEW_SVG,
	isGithubAppToken,
	PCB_CIRCUIT_JSON,
	PCB_PREVIEW_SVG,
	PROJECT_FILE_DIRS,
	PROJECT_WATERMARK_BODY,
	PROJECT_WATERMARK_PATH,
} from "gpio-companion";
import {
	type GithubAppEnv,
	loadGithubAppInstall,
	mintInstallationToken,
} from "./github-app.ts";

export const GITHUB_API = "https://api.github.com";
export const GITHUB_TOKEN_SETTINGS = "https://github.com/settings/tokens";

export type GithubAccount = {
	username: string;
	token: string;
};

export type GithubRepo = {
	full_name: string;
	name: string;
	owner: string;
	html_url: string;
};

export type GithubContent = {
	name: string;
	path: string;
	type: string;
	download_url: string | null;
};

export type ProjectBundle = {
	owner: string;
	repo: string;
	pcb: GithubContent[];
	breadboard: GithubContent[];
	technical: GithubContent[];
	pcbCircuitJsonUrl: string | null;
	pcbPreviewUrl: string | null;
	breadboardCircuitJsonUrl: string | null;
	breadboardPreviewUrl: string | null;
	breadboardDiagramUrl: string | null;
};

export function githubConfigured(
	account: GithubAccount | null | undefined,
): account is GithubAccount {
	return Boolean(account?.username && account?.token);
}

export async function githubAccountForUser(
	env: GithubAppEnv,
	userId: string,
): Promise<GithubAccount | null> {
	const install = await loadGithubAppInstall(env.DYNAMIC_PAGE_KV, userId);
	if (install && env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY) {
		const minted = await mintInstallationToken(
			env,
			install.installationId,
			install.login,
		);
		return { username: install.login, token: minted.token };
	}
	return loadGithubAccount(env.DYNAMIC_PAGE_KV, userId);
}

export async function loadGithubAccount(
	kv: KVNamespace,
	userId: string,
): Promise<GithubAccount | null> {
	const raw = await kv.get(`github:${userId}`);
	if (!raw) {
		return null;
	}
	const parsed = JSON.parse(raw) as Partial<GithubAccount>;
	if (!parsed.username || !parsed.token) {
		return null;
	}
	return { username: parsed.username, token: parsed.token };
}

export async function saveGithubAccount(
	kv: KVNamespace,
	userId: string,
	account: GithubAccount,
): Promise<void> {
	await kv.put(
		`github:${userId}`,
		JSON.stringify({
			username: account.username,
			token: account.token,
		}),
	);
}

export async function listRepos(account: GithubAccount): Promise<GithubRepo[]> {
	const repos = await listAllRepos(account);
	const marked = await mapPool(repos, 8, async (repo) =>
		(await repoHasWatermark(account, repo.owner, repo.name)) ? repo : null,
	);
	return marked.filter((repo): repo is GithubRepo => repo !== null);
}

async function mapPool<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const index = next;
			next += 1;
			out[index] = await fn(items[index] as T);
		}
	}
	const workers = Math.min(Math.max(limit, 1), items.length || 1);
	await Promise.all(Array.from({ length: workers }, () => worker()));
	return out;
}

async function listAllRepos(account: GithubAccount): Promise<GithubRepo[]> {
	if (isGithubAppToken(account.token)) {
		const data = await githubJson<{
			repositories?: Array<{
				full_name: string;
				name: string;
				owner: { login: string };
				html_url: string;
			}>;
		}>(account, "/installation/repositories?per_page=100");
		return (data.repositories ?? []).map((item) => ({
			full_name: item.full_name,
			name: item.name,
			owner: item.owner.login,
			html_url: item.html_url,
		}));
	}
	const items = await githubJson<
		Array<{
			full_name: string;
			name: string;
			owner: { login: string };
			html_url: string;
		}>
	>(account, "/user/repos?affiliation=owner&per_page=100");
	return items.map((item) => ({
		full_name: item.full_name,
		name: item.name,
		owner: item.owner.login,
		html_url: item.html_url,
	}));
}

export function parseRepoName(value: string): string {
	const name = value.trim().replace(/\.git$/i, "");
	if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") {
		throw new Error("use a GitHub repo name like blink-led");
	}
	return name;
}

export async function repoHasWatermark(
	account: GithubAccount,
	owner: string,
	repo: string,
): Promise<boolean> {
	const response = await githubFetch(
		account,
		`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${PROJECT_WATERMARK_PATH}`,
	);
	return response.ok;
}

export async function createGpioCompanionRepo(
	account: GithubAccount,
	name: string,
): Promise<GithubRepo> {
	const repoName = parseRepoName(name);
	const created = await githubJson<{
		full_name: string;
		name: string;
		owner: { login: string };
		html_url: string;
	}>(account, "/user/repos", {
		method: "POST",
		body: JSON.stringify({
			name: repoName,
			auto_init: true,
			private: true,
			description: "gpio-companion project",
		}),
	});
	await putRepoFile(
		account,
		created.owner.login,
		created.name,
		PROJECT_WATERMARK_PATH,
		PROJECT_WATERMARK_BODY,
		"Add gpio-companion project watermark",
	);
	return {
		full_name: created.full_name,
		name: created.name,
		owner: created.owner.login,
		html_url: created.html_url,
	};
}

export async function putRepoFile(
	account: GithubAccount,
	owner: string,
	repo: string,
	path: string,
	content: string,
	message: string,
): Promise<void> {
	await githubJson(
		account,
		`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
		{
			method: "PUT",
			body: JSON.stringify({
				message,
				content: btoa(content),
			}),
		},
	);
}

export async function loadProjectBundle(
	account: GithubAccount,
	owner: string,
	repo: string,
): Promise<ProjectBundle> {
	const dirs = await Promise.all(
		PROJECT_FILE_DIRS.map(async (dir) => {
			try {
				return await listContents(account, owner, repo, dir);
			} catch {
				return [] as GithubContent[];
			}
		}),
	);
	const pcb = dirs[0] ?? [];
	const breadboard = dirs[1] ?? [];
	const technical = dirs[2] ?? [];
	return {
		owner,
		repo,
		pcb,
		breadboard,
		technical,
		pcbCircuitJsonUrl: fileUrl(pcb, PCB_CIRCUIT_JSON),
		pcbPreviewUrl: fileUrl(pcb, PCB_PREVIEW_SVG),
		breadboardCircuitJsonUrl: fileUrl(breadboard, BREADBOARD_CIRCUIT_JSON),
		breadboardPreviewUrl: fileUrl(breadboard, BREADBOARD_PREVIEW_SVG),
		breadboardDiagramUrl: fileUrl(breadboard, BREADBOARD_DIAGRAM_JSON),
	};
}

export async function readRepoFile(
	account: GithubAccount,
	owner: string,
	repo: string,
	path: string,
): Promise<string> {
	const data = await githubJson<{
		content?: string;
		encoding?: string;
		download_url?: string | null;
	}>(
		account,
		`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
	);
	if (data.encoding === "base64" && data.content) {
		return atob(data.content.replace(/\n/g, ""));
	}
	if (data.download_url) {
		const response = await fetch(data.download_url, {
			headers: githubHeaders(account),
		});
		if (!response.ok) {
			throw new Error(`github raw ${response.status}`);
		}
		return response.text();
	}
	throw new Error("github file has no content");
}

async function listContents(
	account: GithubAccount,
	owner: string,
	repo: string,
	path: string,
): Promise<GithubContent[]> {
	const data = await githubJson<GithubContent[] | GithubContent>(
		account,
		`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
	);
	return Array.isArray(data) ? data : [data];
}

function fileUrl(files: GithubContent[], path: string): string | null {
	const name = path.split("/").at(-1);
	const hit = files.find((file) => file.path === path || file.name === name);
	return hit?.download_url ?? null;
}

function githubHeaders(account: GithubAccount): HeadersInit {
	return {
		authorization: `Bearer ${account.token}`,
		accept: "application/vnd.github+json",
		"content-type": "application/json",
		"user-agent": "gpio-companion",
		"x-github-api-version": "2022-11-28",
	};
}

async function githubFetch(
	account: GithubAccount,
	path: string,
	init?: RequestInit,
): Promise<Response> {
	return fetch(`${GITHUB_API}${path}`, {
		...init,
		headers: {
			...githubHeaders(account),
			...(init?.headers ?? {}),
		},
	});
}

async function githubJson<T>(
	account: GithubAccount,
	path: string,
	init?: RequestInit,
): Promise<T> {
	const response = await githubFetch(account, path, init);
	if (!response.ok) {
		let detail = "";
		try {
			const body = (await response.json()) as { message?: string };
			detail = body.message ? `: ${body.message}` : "";
		} catch {
			detail = "";
		}
		throw new Error(`github ${response.status}${detail}`);
	}
	if (response.status === 204) {
		return undefined as T;
	}
	return (await response.json()) as T;
}
