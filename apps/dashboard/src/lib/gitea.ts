import {
	BREADBOARD_CIRCUIT_JSON,
	BREADBOARD_PREVIEW_SVG,
	PCB_CIRCUIT_JSON,
	PCB_PREVIEW_SVG,
	PROJECT_FILE_DIRS,
} from "gpio-companion";

export type GiteaRepo = {
	full_name: string;
	name: string;
	owner: string;
	html_url: string;
};

export type GiteaContent = {
	name: string;
	path: string;
	type: string;
	download_url: string | null;
};

export type ProjectBundle = {
	owner: string;
	repo: string;
	pcb: GiteaContent[];
	breadboard: GiteaContent[];
	technical: GiteaContent[];
	pcbCircuitJsonUrl: string | null;
	pcbPreviewUrl: string | null;
	breadboardCircuitJsonUrl: string | null;
	breadboardPreviewUrl: string | null;
};

type GiteaEnv = {
	GITEA_URL?: string;
	GITEA_TOKEN?: string;
};

export function giteaConfigured(env: GiteaEnv): boolean {
	return Boolean(env.GITEA_URL && env.GITEA_TOKEN);
}

export async function listRepos(env: GiteaEnv): Promise<GiteaRepo[]> {
	const items = await giteaJson<
		Array<{
			full_name: string;
			name: string;
			owner: { login: string };
			html_url: string;
		}>
	>(env, "/api/v1/user/repos?limit=50");
	return items.map((item) => ({
		full_name: item.full_name,
		name: item.name,
		owner: item.owner.login,
		html_url: item.html_url,
	}));
}

export async function loadProjectBundle(
	env: GiteaEnv,
	owner: string,
	repo: string,
): Promise<ProjectBundle> {
	const dirs = await Promise.all(
		PROJECT_FILE_DIRS.map(async (dir) => {
			try {
				return await listContents(env, owner, repo, dir);
			} catch {
				return [] as GiteaContent[];
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
	};
}

export async function readRepoFile(
	env: GiteaEnv,
	owner: string,
	repo: string,
	path: string,
): Promise<string> {
	const base = env.GITEA_URL?.replace(/\/+$/, "");
	if (!base || !env.GITEA_TOKEN) {
		throw new Error("gitea is not configured");
	}
	const url = `${base}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${path}`;
	const response = await fetch(url, {
		headers: { authorization: `token ${env.GITEA_TOKEN}` },
	});
	if (!response.ok) {
		throw new Error(`gitea raw ${response.status}`);
	}
	return response.text();
}

async function listContents(
	env: GiteaEnv,
	owner: string,
	repo: string,
	path: string,
): Promise<GiteaContent[]> {
	const data = await giteaJson<GiteaContent[] | GiteaContent>(
		env,
		`/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`,
	);
	return Array.isArray(data) ? data : [data];
}

function fileUrl(files: GiteaContent[], path: string): string | null {
	const name = path.split("/").at(-1);
	const hit = files.find((file) => file.path === path || file.name === name);
	return hit?.download_url ?? null;
}

async function giteaJson<T>(env: GiteaEnv, path: string): Promise<T> {
	const base = env.GITEA_URL?.replace(/\/+$/, "");
	if (!base || !env.GITEA_TOKEN) {
		throw new Error("gitea is not configured");
	}
	const response = await fetch(`${base}${path}`, {
		headers: {
			authorization: `token ${env.GITEA_TOKEN}`,
			accept: "application/json",
		},
	});
	if (!response.ok) {
		throw new Error(`gitea ${response.status}`);
	}
	return (await response.json()) as T;
}
