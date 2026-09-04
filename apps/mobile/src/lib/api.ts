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

export type Session = {
	id: string | null;
	email: string | null;
	name: string | null;
	role?: string | null;
};

export type Device = {
	uuid: string;
	deviceUrl: string;
	login: string;
	email?: string;
	label?: string;
	userId?: string;
};

export type DeviceStatus = {
	hardware?: string;
	model?: string;
	tunnel?: { configured?: boolean; apiHostname?: string };
	secrets?: { githubReady?: boolean; gpioAiKey?: boolean };
	t3?: T3Status;
	network?: {
		type?: "ethernet" | "wifi" | "unknown";
		ssid?: string;
		interface?: string;
		connection?: string;
	} | null;
};

export type BoardView = {
	device: Device;
	status: DeviceStatus | null;
};

export type Credits = { micros: number; usd: number };

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
	pcbPreviewUrl: string | null;
	breadboardPreviewUrl: string | null;
};

export type GithubAppStatus = {
	connected: boolean;
	login: string;
	installUrl: string;
};

export type PendingRequest = {
	uuid: string;
	requesterEmail?: string;
	login?: string;
	createdAt?: string;
};

export type MaintenanceReport = {
	uuid?: string;
	at?: number;
	diskTotalMb?: number;
	diskAvailMb?: number;
	reclaimedBytes?: number;
	actions?: string[];
};

export type DebugBoard = {
	uuid: string;
	deviceUrl?: string;
	label?: string;
	email?: string;
	login?: string;
	userId?: string;
	paired?: boolean;
	live?: boolean;
	maintenance?: MaintenanceReport | null;
};

export type DebugConnect = {
	wsUrl: string;
	probe: { status: number; error: string; ready: boolean };
};

export type T3Status = {
	running?: boolean;
	pairingUrl?: string;
	pairingToken?: string;
	paired?: boolean;
	serviceInstalled?: boolean;
};

export type T3Pairing = T3Status;

export type AdminDeviceItem = {
	device: Device;
	status: DeviceStatus | null;
};

export function deviceDisplayName(device: {
	label?: string;
	uuid: string;
	login?: string;
}) {
	return device.label?.trim() || device.login || device.uuid;
}

export function getSession(token: string) {
	return request<Session>(token, "/api/mobile/session");
}

export function listDevices(token: string) {
	return request<{ paired: boolean; devices: Device[] }>(
		token,
		"/api/mobile/devices",
	);
}

export function listDeviceStatus(token: string) {
	return request<{ paired: boolean; devices: BoardView[] }>(
		token,
		"/api/mobile/status",
	);
}

export function patchDeviceLabel(token: string, uuid: string, label: string) {
	return request<{ ok: boolean; device: Device }>(
		token,
		"/api/mobile/devices",
		{
			method: "PATCH",
			body: JSON.stringify({ uuid, label }),
		},
	);
}

export function unpairDevice(token: string, uuid: string) {
	return request(
		token,
		`/api/mobile/devices?uuid=${encodeURIComponent(uuid)}`,
		{ method: "DELETE" },
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

export function t3Status(token: string, uuid: string) {
	return request<T3Status>(
		token,
		`/api/mobile/t3?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function t3Action(token: string, action: "pair", uuid: string) {
	return request<T3Status>(token, "/api/mobile/t3", {
		method: "POST",
		body: JSON.stringify({ action, uuid }),
	});
}

export function startT3Pair(token: string, uuid: string) {
	return t3Action(token, "pair", uuid);
}

export function getCredits(token: string) {
	return request<Credits>(token, "/api/mobile/credits");
}

export function grantCredits(token: string, usd = 1) {
	return request<Credits>(token, "/api/mobile/credits", {
		method: "POST",
		body: JSON.stringify({ usd }),
	});
}

export function listProjects(token: string) {
	return request<{ configured: boolean; repos: GithubRepo[] }>(
		token,
		"/api/mobile/projects",
	);
}

export function loadProject(token: string, owner: string, repo: string) {
	return request<ProjectBundle>(token, "/api/mobile/projects", {
		method: "POST",
		body: JSON.stringify({ owner, repo }),
	});
}

export function getGithubApp(token: string) {
	return request<GithubAppStatus>(token, "/api/mobile/github-app");
}

export function listNotifications(token: string) {
	return request<{ items: PendingRequest[] }>(
		token,
		"/api/mobile/notifications",
	);
}

export function resolveNotification(
	token: string,
	uuid: string,
	action: "accept" | "reject",
) {
	return request<{ ok: boolean; action: string }>(
		token,
		"/api/mobile/notifications",
		{
			method: "POST",
			body: JSON.stringify({ uuid, action }),
		},
	);
}

export function listDebugBoards(token: string) {
	return request<{ devices: DebugBoard[] }>(token, "/api/mobile/debug");
}

export function connectDebug(token: string, uuid: string) {
	return request<DebugConnect>(token, "/api/mobile/debug", {
		method: "POST",
		body: JSON.stringify({ uuid }),
	});
}

export function loadDeviceLogs(token: string, uuid: string) {
	return request<{ text: string }>(
		token,
		`/api/mobile/logs?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function loadDeviceInfo(token: string, uuid: string) {
	return request<{ info: unknown }>(
		token,
		`/api/mobile/info?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function signDeviceInfo(token: string, uuid: string) {
	return request<Record<string, unknown>>(token, "/api/mobile/info", {
		method: "POST",
		body: JSON.stringify({ uuid }),
	});
}

export function startDeviceUpdate(token: string, uuid: string) {
	return request<{ started: boolean }>(token, "/api/mobile/update", {
		method: "POST",
		body: JSON.stringify({ uuid }),
	});
}

export function listAdminDevices(token: string) {
	return request<{ devices: AdminDeviceItem[] }>(
		token,
		"/api/mobile/admin/devices",
	);
}

export function patchAdminLabel(token: string, uuid: string, label: string) {
	return request<{ ok: boolean; device: Device }>(
		token,
		"/api/mobile/admin/devices",
		{
			method: "PATCH",
			body: JSON.stringify({ uuid, label }),
		},
	);
}

export function adminUnpair(token: string, uuid: string) {
	return request(
		token,
		`/api/mobile/admin/devices?uuid=${encodeURIComponent(uuid)}`,
		{ method: "DELETE" },
	);
}

export function adminTransfer(token: string, uuid: string, toUserId?: string) {
	return request<{ ok: boolean; device: Device }>(
		token,
		"/api/mobile/admin/devices",
		{
			method: "POST",
			body: JSON.stringify({ uuid, toUserId }),
		},
	);
}
