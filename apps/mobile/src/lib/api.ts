import { dashboardUrl } from "./config.ts";

export type ActionResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string };

export class UnauthorizedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "UnauthorizedError";
	}
}

export type TokenProvider = () => Promise<string | null>;

const REQUEST_TIMEOUT_MS = 15_000;

let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider | null): void {
	tokenProvider = provider;
}

async function fetchOnce(
	token: string,
	path: string,
	init: RequestInit,
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		return await fetch(`${dashboardUrl}${path}`, {
			...init,
			headers: {
				accept: "application/json",
				"content-type": "application/json",
				authorization: `Bearer ${token}`,
				...init.headers,
			},
			signal: controller.signal,
		});
	} catch (caught) {
		if (
			caught instanceof Error &&
			(caught.name === "AbortError" || /abort/i.test(caught.message))
		) {
			throw new Error(
				"request timed out — check your connection and try again",
			);
		}
		throw new Error(
			`could not reach gpio-companion.com — ${
				caught instanceof Error ? caught.message : "network error"
			}`,
		);
	} finally {
		clearTimeout(timer);
	}
}

type Parsed<T> =
	| { ok: true; data: T }
	| { ok: false; unauthorized: boolean; error: string };

async function parseResponse<T>(response: Response): Promise<Parsed<T>> {
	const text = await response.text();
	let body: unknown = null;
	if (text) {
		try {
			body = JSON.parse(text);
		} catch {
			body = null;
		}
	}
	if (
		!body ||
		typeof body !== "object" ||
		typeof (body as { ok?: unknown }).ok !== "boolean"
	) {
		return {
			ok: false,
			unauthorized: response.status === 401,
			error: `gpio-companion.com error (HTTP ${response.status})`,
		};
	}
	const result = body as ActionResult<T>;
	if (result.ok) {
		return { ok: true, data: result.data };
	}
	const error =
		typeof result.error === "string" && result.error.trim().length > 0
			? result.error
			: `request failed (HTTP ${response.status})`;
	const unauthorized =
		response.status === 401 ||
		error === "sign in first" ||
		error === "login first";
	return { ok: false, unauthorized, error };
}

async function request<T>(
	token: string,
	path: string,
	init: RequestInit = {},
	retried = false,
): Promise<T> {
	const response = await fetchOnce(token, path, init);
	const parsed = await parseResponse<T>(response);
	if (parsed.ok) {
		return parsed.data;
	}
	if (parsed.unauthorized && !retried) {
		const next = tokenProvider ? await tokenProvider() : null;
		if (next) {
			return request(next, path, init, true);
		}
	}
	if (parsed.unauthorized) {
		throw new UnauthorizedError(parsed.error);
	}
	throw new Error(parsed.error);
}

export function getSession(token: string) {
	return request<{
		id: string | null;
		email: string | null;
		name: string | null;
	}>(token, "/api/mobile/session");
}

export function listDevices(token: string) {
	return request<{
		paired: boolean;
		devices: Array<{
			uuid: string;
			deviceUrl: string;
			login: string;
			label?: string;
		}>;
	}>(token, "/api/mobile/devices");
}

export function unpairDevice(token: string, uuid: string) {
	return request(
		token,
		`/api/mobile/devices?uuid=${encodeURIComponent(uuid)}`,
		{
			method: "DELETE",
		},
	);
}

export function signCredentials(token: string) {
	return request<Record<string, unknown>>(token, "/api/mobile/pair", {
		method: "PUT",
	});
}

export function claimDevice(
	token: string,
	input: { uuid: string; key: string; deviceUrl?: string },
) {
	return request(token, "/api/mobile/pair", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function signWifi(
	token: string,
	input: { uuid: string; ssid: string; psk: string },
) {
	return request<Record<string, unknown>>(token, "/api/mobile/wifi", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export type T3Pairing = {
	pairingUrl?: string;
	pairingToken?: string;
	paired?: boolean;
};

export function t3Status(token: string, uuid: string) {
	return request<T3Pairing>(
		token,
		`/api/mobile/t3?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function t3Action(token: string, action: "pair", uuid: string) {
	return request<T3Pairing>(token, "/api/mobile/t3", {
		method: "POST",
		body: JSON.stringify({ action, uuid }),
	});
}

export type MaintenanceReport = {
	at?: number;
	diskTotalMb?: number;
	diskAvailMb?: number;
	reclaimedBytes?: number;
	actions?: string[];
};

export type DebugBoard = {
	uuid: string;
	maintenance?: MaintenanceReport | null;
};

export function listDebugBoards(token: string) {
	return request<{ devices: DebugBoard[] }>(token, "/api/mobile/debug");
}

export function loadDeviceLogs(token: string, uuid: string) {
	return request<{ text: string }>(
		token,
		`/api/mobile/logs?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function startDeviceUpdate(token: string, uuid: string) {
	return request<{ started: boolean }>(token, "/api/mobile/update", {
		method: "POST",
		body: JSON.stringify({ uuid }),
	});
}
