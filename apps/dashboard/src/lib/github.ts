import {
	BREADBOARD_CIRCUIT_JSON,
	BREADBOARD_DIAGRAM_JSON,
	BREADBOARD_PREVIEW_SVG,
	PCB_CIRCUIT_JSON,
	PCB_PREVIEW_SVG,
	PROJECT_FILE_DIRS,
} from "gpio-companion";

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
		"user-agent": "gpio-companion",
		"x-github-api-version": "2022-11-28",
	};
}

async function githubJson<T>(account: GithubAccount, path: string): Promise<T> {
	const response = await fetch(`${GITHUB_API}${path}`, {
		headers: githubHeaders(account),
	});
	if (!response.ok) {
		throw new Error(`github ${response.status}`);
	}
	return (await response.json()) as T;
}
