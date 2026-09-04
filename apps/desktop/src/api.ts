import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

export const DASHBOARD_URL = "https://gpio-companion.com";

export type Device = {
	uuid: string;
	deviceUrl: string;
	login: string;
	email?: string;
	label?: string;
	userId?: string;
};

export type DeviceList = {
	paired: boolean;
	devices: Device[];
};

export type Session = {
	id: string | null;
	email: string | null;
	name: string | null;
	role?: string | null;
};

export type NearbyBoard = {
	id: string;
	name: string;
	rssi: number | null;
	matched: boolean;
	pairingUuid?: string | null;
	hardware?: string | null;
};

export function nearbyBoardLabel(board: NearbyBoard) {
	if (board.matched) {
		const name = board.name.trim() || "gpio-companion";
		const extra = board.hardware?.trim() || board.pairingUuid?.slice(0, 8);
		return extra ? `${name} (${extra})` : name;
	}
	if (board.rssi != null) {
		return `Nearby ${board.rssi} dBm — ${board.id}`;
	}
	return board.id;
}

async function call<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	try {
		return await invoke<T>(cmd, args);
	} catch (caught) {
		throw new Error(typeof caught === "string" ? caught : "request failed");
	}
}

export function authToken() {
	return call<string | null>("auth_token");
}

export function authLogin() {
	return call<void>("auth_login");
}

export function authLogout() {
	return call<void>("auth_logout");
}

export function authSession() {
	return call<Session>("auth_session");
}

export function debugLogs() {
	return call<string[]>("debug_logs");
}

export function listDevices() {
	return call<DeviceList>("devices_list");
}

export function unpairDevice(uuid: string) {
	return call<unknown>("devices_unpair", { uuid });
}

export function bleScan() {
	return call<NearbyBoard[]>("ble_scan");
}

export function blePair(id: string) {
	return call<unknown>("ble_pair", { id });
}

export function bleWifi(input: {
	uuid: string;
	ssid: string;
	psk: string;
	id: string;
}) {
	return call<string>("ble_wifi", input);
}

export function onBleStatus(
	handler: (status: string) => void,
): Promise<UnlistenFn> {
	return listen<string>("ble-status", (event) => handler(event.payload));
}

export type DeviceStatus = {
	hardware?: string;
	model?: string;
	tunnel?: { configured?: boolean; apiHostname?: string };
	secrets?: { githubReady?: boolean; gpioAiKey?: boolean };
	t3?: {
		running?: boolean;
		pairingUrl?: string;
		pairingToken?: string;
		paired?: boolean;
		serviceInstalled?: boolean;
	};
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

export type DebugBoard = {
	uuid: string;
	deviceUrl: string;
	label?: string;
	email?: string;
	login?: string;
	userId?: string;
	paired?: boolean;
	live?: boolean;
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

export type AdminDeviceItem = {
	device: Device;
	status: DeviceStatus | null;
};

export function apiRequest<T>(
	method: string,
	path: string,
	body?: unknown,
): Promise<T> {
	return call<T>("api_request", {
		method,
		path,
		body: body ?? null,
	});
}

export function openExternal(url: string) {
	return openUrl(url);
}

export function listDeviceStatus() {
	return apiRequest<{ paired: boolean; devices: BoardView[] }>(
		"GET",
		"/api/mobile/status",
	);
}

export function patchDeviceLabel(uuid: string, label: string) {
	return apiRequest<{ ok: boolean; device: Device }>(
		"PATCH",
		"/api/mobile/devices",
		{ uuid, label },
	);
}

export function getCredits() {
	return apiRequest<Credits>("GET", "/api/mobile/credits");
}

export function grantCredits(usd = 1) {
	return apiRequest<Credits>("POST", "/api/mobile/credits", { usd });
}

export function listProjects() {
	return apiRequest<{ configured: boolean; repos: GithubRepo[] }>(
		"GET",
		"/api/mobile/projects",
	);
}

export function loadProject(owner: string, repo: string) {
	return apiRequest<ProjectBundle>("POST", "/api/mobile/projects", {
		owner,
		repo,
	});
}

export function getGithubApp() {
	return apiRequest<GithubAppStatus>("GET", "/api/mobile/github-app");
}

export function getT3Status(uuid: string) {
	return apiRequest<T3Status>(
		"GET",
		`/api/mobile/t3?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function startT3Pair(uuid: string) {
	return apiRequest<T3Status>("POST", "/api/mobile/t3", {
		action: "pair",
		uuid,
	});
}

export function listNotifications() {
	return apiRequest<{ items: PendingRequest[] }>(
		"GET",
		"/api/mobile/notifications",
	);
}

export function resolveNotification(uuid: string, action: "accept" | "reject") {
	return apiRequest<{ ok: boolean; action: string }>(
		"POST",
		"/api/mobile/notifications",
		{ uuid, action },
	);
}

export function listDebugBoards() {
	return apiRequest<{ devices: DebugBoard[] }>("GET", "/api/mobile/debug");
}

export function connectDebug(uuid: string) {
	return apiRequest<DebugConnect>("POST", "/api/mobile/debug", { uuid });
}

export function listAdminDevices() {
	return apiRequest<{ devices: AdminDeviceItem[] }>(
		"GET",
		"/api/mobile/admin/devices",
	);
}

export function patchAdminLabel(uuid: string, label: string) {
	return apiRequest<{ ok: boolean; device: Device }>(
		"PATCH",
		"/api/mobile/admin/devices",
		{ uuid, label },
	);
}

export function adminUnpair(uuid: string) {
	return apiRequest<unknown>(
		"DELETE",
		`/api/mobile/admin/devices?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function adminTransfer(uuid: string, toUserId?: string) {
	return apiRequest<{ ok: boolean; device: Device }>(
		"POST",
		"/api/mobile/admin/devices",
		{ uuid, toUserId },
	);
}

export function t3EmbedUrl(uuid: string) {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return "";
	}
	return `${DASHBOARD_URL}/api/t3-embed/${encodeURIComponent(trimmed)}/`;
}

export function t3AppUrl(uuid: string) {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return "";
	}
	return `https://t3-${trimmed.replace(/-/g, "")}.gpio-companion.com`;
}

export function t3IframeSrc(uuid: string, token = "") {
	const origin = t3AppUrl(uuid);
	const trimmed = token.trim();
	if (!origin) {
		return "";
	}
	if (!trimmed) {
		return origin;
	}
	return `${origin}/pair#token=${encodeURIComponent(trimmed)}`;
}

export function deviceDisplayName(device: {
	label?: string;
	uuid: string;
	login?: string;
}) {
	return device.label?.trim() || device.login || device.uuid;
}
