export const DEFAULT_DASHBOARD_URL = "https://gpio-companion.com";
export const AI_TOKEN_SKEW_MS = 5 * 60 * 1000;

export type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export type AiAccessCreds = {
	token: string;
	expiresAt: string;
};

export type AiCredentialsOptions = {
	origin?: string;
	uuid: string;
	key: string;
	fetchImpl?: FetchLike;
};

const cache = new Map<string, AiAccessCreds>();

export function dashboardOrigin(origin?: string): string {
	return (
		origin ||
		process.env.GPIO_COMPANION_DASHBOARD_URL ||
		DEFAULT_DASHBOARD_URL
	).replace(/\/+$/, "");
}

export function aiProxyOrigin(origin?: string): string {
	const explicit = process.env.GPIO_COMPANION_AI_URL?.trim();
	if (explicit) {
		return explicit.replace(/\/+$/, "");
	}
	return `${dashboardOrigin(origin)}/api/ai/v1`;
}

export function credentialsCacheKey(uuid: string): string {
	return uuid.trim();
}

export function cachedAiCredentials(
	uuid: string,
	now = Date.now(),
): AiAccessCreds | null {
	const hit = cache.get(credentialsCacheKey(uuid));
	if (!hit) {
		return null;
	}
	if (Date.parse(hit.expiresAt) - now <= AI_TOKEN_SKEW_MS) {
		cache.delete(credentialsCacheKey(uuid));
		return null;
	}
	return hit;
}

export function rememberAiCredentials(
	uuid: string,
	creds: AiAccessCreds,
): void {
	cache.set(credentialsCacheKey(uuid), creds);
}

export function forgetAiCredentials(uuid: string): void {
	cache.delete(credentialsCacheKey(uuid));
}

export async function fetchAiCredentials(
	options: AiCredentialsOptions,
): Promise<AiAccessCreds> {
	const uuid = options.uuid.trim();
	if (!uuid || !options.key) {
		throw new Error("pairing uuid and key are required");
	}
	const cached = cachedAiCredentials(uuid);
	if (cached) {
		return cached;
	}
	const fetcher = options.fetchImpl ?? fetch;
	const origin = dashboardOrigin(options.origin);
	const response = await fetcher(`${origin}/api/ai/credentials`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ uuid, key: options.key }),
	});
	if (!response.ok) {
		let detail = `ai credentials ${response.status}`;
		try {
			const body = (await response.json()) as { error?: string };
			if (body.error) {
				detail = body.error;
			}
		} catch {
			detail = `ai credentials ${response.status}`;
		}
		throw new Error(detail);
	}
	const body = (await response.json()) as Partial<AiAccessCreds>;
	const token = body.token?.trim() ?? "";
	if (!token) {
		throw new Error("ai credentials missing token");
	}
	const creds: AiAccessCreds = {
		token,
		expiresAt: body.expiresAt ?? new Date(Date.now() + 3_600_000).toISOString(),
	};
	rememberAiCredentials(uuid, creds);
	return creds;
}

export async function proxyAiRequest(options: {
	request: Request;
	path: string;
	bodyText: string;
	uuid: string;
	key: string;
	origin?: string;
	fetchImpl?: FetchLike;
}): Promise<Response> {
	const creds = await fetchAiCredentials({
		uuid: options.uuid,
		key: options.key,
		origin: options.origin,
		fetchImpl: options.fetchImpl,
	});
	const suffix = options.path.slice("/v1/ai".length) || "/";
	const target = `${aiProxyOrigin(options.origin)}${suffix}`;
	const headers = new Headers();
	headers.set("authorization", `Bearer ${creds.token}`);
	const contentType = options.request.headers.get("content-type");
	if (contentType) {
		headers.set("content-type", contentType);
	}
	const method = options.request.method.toUpperCase();
	const init: RequestInit = { method, headers };
	if (method !== "GET" && method !== "HEAD") {
		init.body = options.bodyText;
	}
	const fetcher = options.fetchImpl ?? fetch;
	const upstream = await fetcher(target, init);
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/json",
		},
	});
}
