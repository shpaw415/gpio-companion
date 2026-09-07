import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
	isOfflineSignFallback,
	type OfflineGrantBundle,
	shouldMintOfflineKey,
	signOfflineEnvelope,
} from "./offline-sign";

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

function looksLikeMac(value: string) {
	const hex = value.replace(/[^0-9a-fA-F]/g, "");
	if (hex.length !== 12) {
		return false;
	}
	return [...value].every((ch) => /[0-9a-fA-F:\-_]/.test(ch));
}

function rssiSuffix(rssi: number | null) {
	return rssi != null ? ` (${rssi} dBm)` : "";
}

export function nearbyBoardLabel(board: NearbyBoard) {
	const name = board.name.trim();
	const named = Boolean(name) && !looksLikeMac(name);
	if (board.matched) {
		const display = named ? name : "gpio-companion";
		const extra = board.hardware?.trim() || board.pairingUuid?.slice(0, 8);
		return extra ? `${display} (${extra})` : display;
	}
	if (named) {
		return `${name}${rssiSuffix(board.rssi)}`;
	}
	return `Nearby radio${rssiSuffix(board.rssi)}`;
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

async function loadOfflineKey(uuid: string) {
	return call<OfflineGrantBundle | null>("offline_keys_get", { uuid });
}

export async function saveOfflineKey(record: OfflineGrantBundle) {
	await call<void>("offline_keys_put", { record });
}

export async function ensureOfflineKey(uuid: string) {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return null;
	}
	const existing = await loadOfflineKey(trimmed);
	if (!shouldMintOfflineKey(existing)) {
		return existing;
	}
	try {
		const bundle = await apiRequest<OfflineGrantBundle>(
			"POST",
			"/api/mobile/offline-key",
			{ uuid: trimmed },
		);
		const record = { ...bundle, uuid: trimmed };
		await saveOfflineKey(record);
		return record;
	} catch {
		return existing && existing.exp > Date.now() ? existing : null;
	}
}

async function bleWriteEnvelope(id: string, uuid: string, envelope: unknown) {
	return call<string>("ble_write_envelope", { id, uuid, envelope });
}

function parseBoardJson<T>(raw: string, missing: string): T {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch {
		throw new Error(missing);
	}
	if (
		parsed &&
		typeof parsed === "object" &&
		"error" in parsed &&
		typeof (parsed as { error?: unknown }).error === "string"
	) {
		throw new Error((parsed as { error: string }).error);
	}
	return parsed as T;
}

async function withOfflineBle<T>(
	uuid: string,
	id: string,
	online: () => Promise<T>,
	local: { method: string; path: string; body?: string },
	fromRaw?: (raw: string) => T,
): Promise<T> {
	try {
		return await online();
	} catch (error) {
		if (!isOfflineSignFallback(error)) {
			throw error;
		}
		const record = await loadOfflineKey(uuid);
		if (!record || record.exp <= Date.now()) {
			throw new Error("Go online once to issue a 24h Bluetooth key");
		}
		const envelope = await signOfflineEnvelope({
			bundle: record,
			method: local.method,
			path: local.path,
			body: local.body,
		});
		const raw = await bleWriteEnvelope(id, uuid, envelope);
		if (fromRaw) {
			return fromRaw(raw);
		}
		return raw as T;
	}
}

export function bleWifi(input: {
	uuid: string;
	ssid: string;
	psk: string;
	id: string;
}) {
	return withOfflineBle(
		input.uuid,
		input.id,
		() => call<string>("ble_wifi", input),
		{
			method: "PUT",
			path: "/v1/config/wifi",
			body: JSON.stringify({
				ssid: input.ssid.trim(),
				psk: input.psk,
				uuid: input.uuid,
			}),
		},
	);
}

export function bleInfo(input: { uuid: string; id?: string }) {
	const id = input.id ?? "";
	return withOfflineBle(
		input.uuid,
		id,
		() =>
			call<unknown>("ble_info", {
				uuid: input.uuid,
				id,
			}),
		{ method: "GET", path: "/v1/info" },
		(raw) => parseBoardJson(raw, "board did not return companion info"),
	);
}

export function bleGpio(input: {
	uuid: string;
	id?: string;
	physical?: number;
	dir?: string;
	value?: number;
}) {
	const id = input.id ?? "";
	const put = input.physical !== undefined;
	return withOfflineBle(
		input.uuid,
		id,
		() =>
			call<GpioSnapshot>("ble_gpio", {
				uuid: input.uuid,
				id,
				physical: input.physical ?? null,
				dir: input.dir ?? "",
				value: input.value ?? null,
			}),
		{
			method: put ? "PUT" : "GET",
			path: "/v1/gpio",
			body: put
				? JSON.stringify({
						physical: input.physical,
						dir: input.dir,
						value: input.value,
					})
				: "",
		},
		(raw) => parseBoardJson<GpioSnapshot>(raw, "board did not return gpio"),
	);
}

export type KnownNetwork = {
	ssid: string;
	psk: string;
	source: "os" | "saved";
	current: boolean;
};

export function wifiKnownNetworks() {
	return call<KnownNetwork[]>("wifi_known_networks");
}

export function wifiNetworkPsk(ssid: string) {
	return call<string>("wifi_network_psk", { ssid });
}

export function wifiRememberNetwork(ssid: string, psk: string) {
	return call<void>("wifi_remember_network", { ssid, psk });
}

export function knownNetworkLabel(network: KnownNetwork) {
	if (network.current) {
		return `${network.ssid} (this computer)`;
	}
	if (network.source === "saved") {
		return `${network.ssid} (saved)`;
	}
	return network.ssid;
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
	deviceUrl: string;
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

export type FlashPort = {
	address: string;
	protocol?: string;
	fqbn?: string;
	name?: string;
};

export type FlashStatus = {
	running: boolean;
	last: {
		ok: boolean;
		fqbn: string;
		dir: string;
		port?: string;
		log: string;
	} | null;
};

export function loadFlash(uuid: string) {
	return apiRequest<FlashStatus>(
		"GET",
		`/api/mobile/flash?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function loadFlashPorts(uuid: string) {
	return apiRequest<{ ports: FlashPort[] }>(
		"GET",
		`/api/mobile/flash?uuid=${encodeURIComponent(uuid)}&ports=1`,
	);
}

export function startFlash(input: {
	uuid: string;
	fqbn: string;
	dir: string;
	port?: string;
}) {
	return apiRequest<{ started: boolean }>("POST", "/api/mobile/flash", input);
}

export function bleFlash(input: {
	uuid: string;
	id?: string;
	fqbn?: string;
	dir?: string;
	port?: string;
	ports?: boolean;
}) {
	const id = input.id ?? "";
	const flash = Boolean(input.fqbn);
	const ports = Boolean(input.ports);
	const put: { fqbn?: string; dir?: string; port?: string } = {};
	if (flash) {
		put.fqbn = input.fqbn;
		put.dir = input.dir;
		if (input.port) {
			put.port = input.port;
		}
	}
	return withOfflineBle(
		input.uuid,
		id,
		() =>
			call<unknown>("ble_flash", {
				uuid: input.uuid,
				id,
				fqbn: input.fqbn ?? "",
				dir: input.dir ?? "",
				port: input.port ?? "",
				ports: input.ports ?? false,
			}),
		{
			method: flash ? "POST" : "GET",
			path: ports ? "/v1/flash/ports" : "/v1/flash",
			body: flash ? JSON.stringify(put) : "",
		},
		(raw) => parseBoardJson(raw, "board did not return flash"),
	);
}

export function loadDeviceLogs(uuid: string) {
	return apiRequest<{ text: string }>(
		"GET",
		`/api/mobile/logs?uuid=${encodeURIComponent(uuid)}`,
	);
}

export type GpioPinState = {
	physical: number;
	name: string;
	type: string;
	dir?: "in" | "out";
	value?: 0 | 1;
	reserved?: boolean;
	unresolved?: boolean;
};

export type GpioSnapshot = {
	hardware: string;
	pins: GpioPinState[];
};

export function loadGpio(uuid: string) {
	return apiRequest<GpioSnapshot>(
		"GET",
		`/api/mobile/gpio?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function putGpio(input: {
	uuid: string;
	physical: number;
	dir?: string;
	value?: number;
}) {
	return apiRequest<GpioSnapshot>("PUT", "/api/mobile/gpio", input);
}

export function loadDeviceInfo(uuid: string) {
	return apiRequest<{ info: unknown }>(
		"GET",
		`/api/mobile/info?uuid=${encodeURIComponent(uuid)}`,
	);
}

export function startDeviceUpdate(uuid: string) {
	return apiRequest<{ started: boolean }>("POST", "/api/mobile/update", {
		uuid,
	});
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
	const encoded = encodeURIComponent(trimmed);
	return `${origin}/pair?token=${encoded}#token=${encoded}`;
}

export function deviceDisplayName(device: {
	label?: string;
	uuid: string;
	login?: string;
}) {
	return device.label?.trim() || device.login || device.uuid;
}
