export const PROJECT_FILE_DIRS = ["pcb", "breadboard", "technical"] as const;

export type ProjectFileDir = (typeof PROJECT_FILE_DIRS)[number];

export const PROJECT_WATERMARK_PATH = ".gpio-companion";
export const PROJECT_WATERMARK_BODY = "gpio-companion\n";
export const PROJECTS_SYNC_PATH = "/v1/projects/sync";
export const PROJECTS_DIR_NAME = "projects";
export const MAX_PROJECT_WATERMARK_CHECKS = 80;
export const PROJECT_REPO_DESCRIPTION = "gpio-companion project";

export type ProjectWatermarkCandidate = {
	name: string;
	full_name?: string;
	description?: string;
};

export function pickProjectWatermarkCandidates<
	T extends ProjectWatermarkCandidate,
>(
	repos: T[],
	extraNames: Iterable<string> = [],
	searchNames: Iterable<string> = [],
	max = MAX_PROJECT_WATERMARK_CHECKS,
): T[] {
	if (repos.length <= max) {
		return repos;
	}
	const extra = new Set(extraNames);
	const search = new Set(searchNames);
	const preferred = repos.filter((repo) => {
		const full = repo.full_name || repo.name;
		return (
			extra.has(full) ||
			search.has(full) ||
			repo.description === PROJECT_REPO_DESCRIPTION
		);
	});
	if (preferred.length > 0) {
		return preferred.slice(0, max);
	}
	return repos.slice(0, max);
}

export type ProjectSyncPut = {
	owner?: string;
	name?: string;
};

export function parseGithubRepoName(value: string): string {
	const name = value.trim().replace(/\.git$/i, "");
	if (!/^[A-Za-z0-9._-]+$/.test(name) || name === "." || name === "..") {
		throw new Error("use a GitHub repo name like blink-led");
	}
	return name;
}

export function githubCloneUrl(owner: string, name: string): string {
	return `https://github.com/${owner}/${name}.git`;
}

export function parseProjectSyncPut(input: unknown): ProjectSyncPut {
	if (input == null) {
		return {};
	}
	if (typeof input !== "object" || Array.isArray(input)) {
		throw new Error("body must be an object");
	}
	const record = input as Record<string, unknown>;
	const ownerRaw = record.owner;
	const nameRaw = record.name;
	if (ownerRaw == null && nameRaw == null) {
		return {};
	}
	if (typeof ownerRaw !== "string" || typeof nameRaw !== "string") {
		throw new Error("owner and name are required");
	}
	return {
		owner: parseGithubRepoName(ownerRaw),
		name: parseGithubRepoName(nameRaw),
	};
}

export const PCB_CIRCUIT_JSON = "pcb/circuit.json";
export const PCB_PREVIEW_SVG = "pcb/preview.svg";
export const BREADBOARD_CIRCUIT_JSON = "breadboard/circuit.json";
export const BREADBOARD_PREVIEW_SVG = "breadboard/preview.svg";

export function isProjectFileDir(value: string): value is ProjectFileDir {
	return (PROJECT_FILE_DIRS as readonly string[]).includes(value);
}
