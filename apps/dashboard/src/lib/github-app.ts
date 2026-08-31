import {
	createGithubAppJwt,
	GITHUB_API,
	GITHUB_GIT_USER,
	timingSafeEqualString,
} from "gpio-companion";
import {
	loadDevices,
	pairOwnerKey,
	type PairingKv,
} from "./pairing-store.ts";

export type GithubAppEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GITHUB_APP_ID?: string;
	GITHUB_APP_PRIVATE_KEY?: string;
	GITHUB_APP_SLUG?: string;
};

export type GithubAppInstall = {
	installationId: number;
	login: string;
};

export type GithubInstallationToken = {
	token: string;
	expiresAt: string;
	login: string;
	username: string;
};

export function githubAppKey(userId: string): string {
	return `github-app:${userId}`;
}

export function githubAppStateKey(state: string): string {
	return `github-app-state:${state}`;
}

export function parseGithubAppInstall(raw: string | null): GithubAppInstall | null {
	if (!raw) {
		return null;
	}
	const parsed = JSON.parse(raw) as Partial<GithubAppInstall>;
	const installationId = Number(parsed.installationId);
	const login = typeof parsed.login === "string" ? parsed.login.trim() : "";
	if (!Number.isFinite(installationId) || installationId <= 0 || !login) {
		return null;
	}
	return { installationId, login };
}

export async function loadGithubAppInstall(
	kv: PairingKv,
	userId: string,
): Promise<GithubAppInstall | null> {
	return parseGithubAppInstall(await kv.get(githubAppKey(userId)));
}

export async function saveGithubAppInstall(
	kv: PairingKv,
	userId: string,
	install: GithubAppInstall,
): Promise<void> {
	await kv.put(githubAppKey(userId), JSON.stringify(install));
}

export function githubAppInstallUrl(slug: string, state: string): string {
	return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`;
}

async function githubAppHeaders(env: GithubAppEnv): Promise<HeadersInit> {
	const jwt = await createGithubAppJwt(
		env.GITHUB_APP_ID ?? "",
		env.GITHUB_APP_PRIVATE_KEY ?? "",
	);
	return {
		authorization: `Bearer ${jwt}`,
		accept: "application/vnd.github+json",
		"user-agent": "gpio-companion",
		"x-github-api-version": "2022-11-28",
	};
}

async function githubAppFetch(
	env: GithubAppEnv,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const headers = await githubAppHeaders(env);
	let last: Response | undefined;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		last = await fetch(`${GITHUB_API}${path}`, {
			...init,
			headers: { ...headers, ...(init.headers ?? {}) },
		});
		if (last.status < 500) {
			return last;
		}
	}
	return last as Response;
}

export async function readGithubInstallation(
	env: GithubAppEnv,
	installationId: number,
): Promise<{ id: number; login: string }> {
	const response = await githubAppFetch(env, `/app/installations/${installationId}`);
	if (!response.ok) {
		throw new Error("github app installation not found");
	}
	const body = (await response.json()) as {
		id?: number;
		account?: { login?: string };
	};
	const login = body.account?.login?.trim() ?? "";
	if (!login) {
		throw new Error("github app installation has no account");
	}
	return { id: body.id ?? installationId, login };
}

export async function mintInstallationToken(
	env: GithubAppEnv,
	installationId: number,
	login: string,
): Promise<GithubInstallationToken> {
	const response = await githubAppFetch(
		env,
		`/app/installations/${installationId}/access_tokens`,
		{ method: "POST" },
	);
	if (!response.ok) {
		throw new Error("github app token mint failed");
	}
	const body = (await response.json()) as {
		token?: string;
		expires_at?: string;
	};
	const token = body.token?.trim() ?? "";
	if (!token) {
		throw new Error("github app token mint failed");
	}
	return {
		token,
		expiresAt: body.expires_at ?? new Date(Date.now() + 3_600_000).toISOString(),
		login,
		username: GITHUB_GIT_USER,
	};
}

export async function issueGithubCredentials(
	env: GithubAppEnv,
	uuid: string,
	key: string,
): Promise<GithubInstallationToken> {
	const trimmed = uuid.trim();
	if (!trimmed || !key) {
		throw new Error("uuid and key are required");
	}
	const ownerId = await env.DYNAMIC_PAGE_KV.get(pairOwnerKey(trimmed));
	if (!ownerId) {
		throw new Error("unknown pairing");
	}
	const devices = await loadDevices(env.DYNAMIC_PAGE_KV, ownerId);
	const device = devices.find((item) => item.uuid === trimmed);
	if (!device || !timingSafeEqualString(device.key, key)) {
		throw new Error("pairing key mismatch");
	}
	const install = await loadGithubAppInstall(env.DYNAMIC_PAGE_KV, ownerId);
	if (!install) {
		throw new Error("GitHub App is not connected");
	}
	return mintInstallationToken(env, install.installationId, install.login);
}