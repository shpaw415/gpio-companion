import {
	BREADBOARD_CIRCUIT_JSON,
	BREADBOARD_DIAGRAM_JSON,
	BREADBOARD_PREVIEW_SVG,
	isGithubAppToken,
	PCB_CIRCUIT_JSON,
	PCB_PREVIEW_SVG,
	PROJECT_FILE_DIRS,
	PROJECT_REPO_DESCRIPTION,
	PROJECT_WATERMARK_BODY,
	PROJECT_WATERMARK_PATH,
	parseGithubRepoName,
	pickProjectWatermarkCandidates,
} from "gpio-companion";
import {
	type GithubAppEnv,
	loadFreshUserToken,
	loadGithubAppInstall,
	mintInstallationToken,
} from "./github-app.ts";

export const GITHUB_API = "https://api.github.com";
export const GITHUB_TOKEN_SETTINGS = "https://github.com/settings/tokens";

export type GithubAccount = {
	username: string;
	token: string;
	createToken?: string;
	installationId?: number;
};

export type GithubRepo = {
	full_name: string;
	name: string;
	owner: string;
	html_url: string;
	description?: string;
};

type ListedRepo = GithubRepo;

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
		const createToken = await loadFreshUserToken(env, userId, install);
		return {
			username: install.login,
			token: minted.token,
			installationId: install.installationId,
			...(createToken ? { createToken } : {}),
		};
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

export function githubProjectsKey(userId: string): string {
	return `github-projects:${userId}`;
}

export async function loadIndexedProjects(
	kv: KVNamespace,
	userId: string,
): Promise<GithubRepo[]> {
	const raw = await kv.get(githubProjectsKey(userId));
	if (!raw) {
		return [];
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter(isGithubRepo);
	} catch {
		return [];
	}
}

export async function indexProject(
	kv: KVNamespace,
	userId: string,
	repo: GithubRepo,
): Promise<void> {
	const current = await loadIndexedProjects(kv, userId);
	if (current.some((item) => item.full_name === repo.full_name)) {
		return;
	}
	await kv.put(
		githubProjectsKey(userId),
		JSON.stringify([publicRepo(repo), ...current.map(publicRepo)]),
	);
}

function isGithubRepo(value: unknown): value is GithubRepo {
	if (!value || typeof value !== "object") {
		return false;
	}
	const repo = value as Partial<GithubRepo>;
	return Boolean(repo.full_name && repo.name && repo.owner && repo.html_url);
}

function publicRepo(repo: GithubRepo): GithubRepo {
	return {
		full_name: repo.full_name,
		name: repo.name,
		owner: repo.owner,
		html_url: repo.html_url,
	};
}

function readerAccount(account: GithubAccount): GithubAccount {
	if (!account.createToken) {
		return account;
	}
	return {
		username: account.username,
		token: account.createToken,
		installationId: account.installationId,
	};
}

export async function listRepos(
	account: GithubAccount,
	extra: GithubRepo[] = [],
): Promise<GithubRepo[]> {
	const reader = readerAccount(account);
	const extraNames = new Set(
		extra.map((repo) => repo.full_name).filter(Boolean),
	);
	const [installed, owned, searched, watermarked] = await Promise.all([
		listAllRepos(account).catch(() => [] as ListedRepo[]),
		account.createToken
			? listOwnedRepos(reader).catch(() => [] as ListedRepo[])
			: Promise.resolve([] as ListedRepo[]),
		searchProjectRepos(reader).catch(() => [] as ListedRepo[]),
		searchWatermarkedRepos(reader).catch(() => [] as ListedRepo[]),
	]);
	const searchNames = new Set(
		[...searched, ...watermarked].map((repo) => repo.full_name),
	);
	const byName = new Map<string, ListedRepo>();
	for (const repo of [
		...installed,
		...owned,
		...searched,
		...watermarked,
		...extra,
	]) {
		if (!repo.full_name) {
			continue;
		}
		byName.set(repo.full_name, {
			...publicRepo(repo),
			...(repo.description ? { description: repo.description } : {}),
		});
	}
	const candidates = pickProjectWatermarkCandidates(
		[...byName.values()],
		extraNames,
		searchNames,
	);
	const marked = await mapPool(candidates, 8, async (repo) =>
		(await repoVisibleAsProject(reader, account, repo))
			? publicRepo(repo)
			: null,
	);
	return marked.filter((repo): repo is GithubRepo => repo !== null);
}

async function repoVisibleAsProject(
	reader: GithubAccount,
	fallback: GithubAccount,
	repo: ListedRepo,
): Promise<boolean> {
	if (await repoHasWatermark(reader, repo.owner, repo.name)) {
		return true;
	}
	if (reader.token !== fallback.token) {
		return repoHasWatermark(fallback, repo.owner, repo.name);
	}
	return false;
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

type RepoJson = {
	full_name: string;
	name: string;
	owner: { login: string };
	html_url: string;
	description?: string | null;
};

function mapRepo(item: RepoJson): ListedRepo {
	return {
		full_name: item.full_name,
		name: item.name,
		owner: item.owner.login,
		html_url: item.html_url,
		...(item.description ? { description: item.description } : {}),
	};
}

async function listAllRepos(account: GithubAccount): Promise<ListedRepo[]> {
	if (isGithubAppToken(account.token)) {
		return githubPaginate<{ repositories?: RepoJson[] }>(
			account,
			"/installation/repositories?per_page=100",
			(body) => (body.repositories ?? []).map(mapRepo),
		);
	}
	return listOwnedRepos(account);
}

async function listOwnedRepos(account: GithubAccount): Promise<ListedRepo[]> {
	return githubPaginate<RepoJson[]>(
		account,
		"/user/repos?affiliation=owner&per_page=100",
		(body) => (Array.isArray(body) ? body.map(mapRepo) : []),
	);
}

async function searchProjectRepos(
	account: GithubAccount,
): Promise<ListedRepo[]> {
	const query = `user:${account.username} "${REPO_DESCRIPTION}" in:description`;
	try {
		const data = await githubJson<{ items?: RepoJson[] }>(
			account,
			`/search/repositories?per_page=100&q=${encodeURIComponent(query)}`,
		);
		return (data.items ?? []).map(mapRepo);
	} catch {
		return [];
	}
}

async function searchWatermarkedRepos(
	account: GithubAccount,
): Promise<ListedRepo[]> {
	const query = `filename:${PROJECT_WATERMARK_PATH} user:${account.username}`;
	try {
		const data = await githubJson<{
			items?: Array<{ repository?: RepoJson }>;
		}>(account, `/search/code?per_page=100&q=${encodeURIComponent(query)}`);
		return (data.items ?? [])
			.map((item) => item.repository)
			.filter((item): item is RepoJson => Boolean(item?.full_name))
			.map(mapRepo);
	} catch {
		return [];
	}
}

export function parseRepoName(value: string): string {
	return parseGithubRepoName(value);
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

const REPO_DESCRIPTION = PROJECT_REPO_DESCRIPTION;

type CreatedGithubRepo = {
	id?: number;
	full_name: string;
	name: string;
	owner: { login: string };
	html_url: string;
};

function githubCreateDenied(detail: string): Error {
	const suffix = detail.trim() ? `: ${detail.trim()}` : "";
	return new Error(
		`github cannot create that repository${suffix}. Reconnect GitHub on Profile to allow creating repositories.`,
	);
}

function rethrowGithubCreate(caught: unknown): never {
	const message =
		caught instanceof Error ? caught.message : "github create failed";
	if (/not accessible by integration/i.test(message)) {
		throw githubCreateDenied(message);
	}
	throw caught instanceof Error ? caught : new Error(message);
}

async function githubOwner(
	account: GithubAccount,
): Promise<{ login: string; type: string; node_id: string }> {
	return githubJson(account, `/users/${encodeURIComponent(account.username)}`);
}

const CREATE_REPO_BODY = {
	auto_init: true,
	private: true,
	description: REPO_DESCRIPTION,
};

async function createRepoAsApp(
	account: GithubAccount,
	repoName: string,
): Promise<{ created: CreatedGithubRepo; writer: GithubAccount }> {
	if (account.createToken) {
		const writer = {
			username: account.username,
			token: account.createToken,
		};
		const created = await githubJson<CreatedGithubRepo>(writer, "/user/repos", {
			method: "POST",
			body: JSON.stringify({ name: repoName, ...CREATE_REPO_BODY }),
		});
		if (account.installationId && created.id) {
			await githubFetch(
				writer,
				`/user/installations/${account.installationId}/repositories/${created.id}`,
				{ method: "PUT" },
			).catch(() => undefined);
		}
		return { created, writer };
	}
	const owner = await githubOwner(account);
	if (owner.type === "Organization") {
		return {
			created: await githubJson<CreatedGithubRepo>(
				account,
				`/orgs/${encodeURIComponent(owner.login)}/repos`,
				{
					method: "POST",
					body: JSON.stringify({ name: repoName, ...CREATE_REPO_BODY }),
				},
			),
			writer: account,
		};
	}
	throw githubCreateDenied("reconnect GitHub on Profile");
}

export async function createGpioCompanionRepo(
	account: GithubAccount,
	name: string,
): Promise<GithubRepo> {
	const repoName = parseRepoName(name);
	let created: CreatedGithubRepo;
	let writer: GithubAccount = account;
	try {
		if (isGithubAppToken(account.token)) {
			const result = await createRepoAsApp(account, repoName);
			created = result.created;
			writer = result.writer;
		} else {
			created = await githubJson<CreatedGithubRepo>(account, "/user/repos", {
				method: "POST",
				body: JSON.stringify({ name: repoName, ...CREATE_REPO_BODY }),
			});
		}
	} catch (caught) {
		rethrowGithubCreate(caught);
	}
	await putRepoFile(
		writer,
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
	const reader = readerAccount(account);
	const dirs = await Promise.all(
		PROJECT_FILE_DIRS.map(async (dir) => {
			try {
				return await listContents(reader, owner, repo, dir);
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
	const reader = readerAccount(account);
	const data = await githubJson<{
		content?: string;
		encoding?: string;
		download_url?: string | null;
	}>(
		reader,
		`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
	);
	if (data.encoding === "base64" && data.content) {
		return atob(data.content.replace(/\n/g, ""));
	}
	if (data.download_url) {
		const response = await fetch(data.download_url, {
			headers: githubHeaders(reader),
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

function githubUrl(path: string): string {
	if (
		path.startsWith("https://api.github.com/") ||
		path.startsWith(GITHUB_API)
	) {
		return path;
	}
	return `${GITHUB_API}${path}`;
}

function nextLink(header: string | null): string | null {
	if (!header) {
		return null;
	}
	for (const part of header.split(",")) {
		const match = part.match(/<([^>]+)>\s*;\s*rel="next"/);
		if (match?.[1]) {
			return match[1];
		}
	}
	return null;
}

async function githubFetch(
	account: GithubAccount,
	path: string,
	init?: RequestInit,
): Promise<Response> {
	return fetch(githubUrl(path), {
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
	const { body } = await githubJsonWithLink<T>(account, path, init);
	return body;
}

async function githubJsonWithLink<T>(
	account: GithubAccount,
	path: string,
	init?: RequestInit,
): Promise<{ body: T; next: string | null }> {
	const response = await githubFetch(account, path, init);
	if (!response.ok) {
		let detail = "";
		try {
			const payload = (await response.json()) as { message?: string };
			detail = payload.message ? `: ${payload.message}` : "";
		} catch {
			detail = "";
		}
		throw new Error(`github ${response.status}${detail}`);
	}
	if (response.status === 204) {
		return { body: undefined as T, next: null };
	}
	return {
		body: (await response.json()) as T,
		next: nextLink(response.headers.get("link")),
	};
}

async function githubPaginate<T>(
	account: GithubAccount,
	path: string,
	items: (body: T) => ListedRepo[],
): Promise<ListedRepo[]> {
	const out: ListedRepo[] = [];
	let next: string | null = path;
	for (let page = 0; next && page < 10; page += 1) {
		const result: { body: T; next: string | null } =
			await githubJsonWithLink<T>(account, next);
		out.push(...items(result.body));
		next = result.next;
	}
	return out;
}
