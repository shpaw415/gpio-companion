import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const FALLBACK_INFO_SCRIPT = "/opt/gpio-companion/scripts/info.sh";

export type InfoScriptLookup = {
	env?: NodeJS.Dict<string>;
	exists?: (path: string) => boolean;
	readRepoPath?: () => string | null;
	sourceDir?: string | null;
};

export function infoScriptCandidates(lookup: InfoScriptLookup = {}): string[] {
	const env = lookup.env ?? process.env;
	const candidates: string[] = [];
	const fromEnv = env.GPIO_COMPANION_INFO_SCRIPT?.trim();
	if (fromEnv) {
		candidates.push(fromEnv);
	}
	const repo = lookup.readRepoPath
		? lookup.readRepoPath()
		: defaultRepoPath(env);
	if (repo) {
		candidates.push(join(repo, "scripts/info.sh"));
	}
	candidates.push(FALLBACK_INFO_SCRIPT);
	const here =
		lookup.sourceDir === undefined ? defaultSourceDir() : lookup.sourceDir;
	if (here) {
		candidates.push(join(here, "../../../scripts/info.sh"));
	}
	return candidates;
}

export function resolveInfoScriptPath(
	lookup: InfoScriptLookup = {},
): string | null {
	const exists = lookup.exists ?? existsSync;
	return infoScriptCandidates(lookup).find((path) => exists(path)) ?? null;
}

export function readDeviceInfoJson(): Record<string, unknown> {
	const script = resolveInfoScriptPath();
	if (!script) {
		throw new Error("info script not found");
	}
	const proc = Bun.spawnSync(["bash", script, "--json"], {
		stdout: "pipe",
		stderr: "pipe",
		timeout: 15_000,
	});
	if (proc.exitCode !== 0) {
		throw new Error("info script failed");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(proc.stdout));
	} catch {
		throw new Error("info script returned invalid json");
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("info script returned invalid json");
	}
	return parsed as Record<string, unknown>;
}

function defaultRepoPath(env: NodeJS.Dict<string>): string | null {
	const configDir =
		env.GPIO_COMPANION_CONFIG_DIR?.trim() || "/etc/gpio-companion";
	try {
		const repo = readFileSync(join(configDir, "repo.path"), "utf8").trim();
		return repo.length > 0 ? repo : null;
	} catch {
		return null;
	}
}

function defaultSourceDir(): string | null {
	try {
		return dirname(fileURLToPath(import.meta.url));
	} catch {
		return null;
	}
}
