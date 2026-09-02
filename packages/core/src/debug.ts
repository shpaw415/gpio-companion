import { DEVICE_AUTH_HEADERS, type DeviceAuthHeaders } from "./device-auth.ts";
import { publicDeviceUrl, tunnelHostnames } from "./tunnel-host.ts";

export type DebugLevel = "error" | "warning";

export type DebugEvent = {
	t: number;
	level: DebugLevel;
	method: string;
	path: string;
	status: number;
	message: string;
};

export const DEBUG_PATH = "/v1/debug";
export const DEBUG_UPGRADE_FAILED = "upgrade failed";
export const DEBUG_LIVE_PATH = "/api/debug/live";
export const DEBUG_LIVE_TTL_SEC = 120;
export const DEBUG_LIVE_PING_MS = 30_000;
export const DEBUG_MAX_SOCKETS = 8;
export const DEBUG_RING_SIZE = 100;
export const DEFAULT_DASHBOARD_ORIGIN = "https://gpio-companion.com";

export function normalizeDebugPath(pathname: string): string {
	const path = pathname.replace(/\/+$/, "") || "/";
	const query = path.indexOf("?");
	return query === -1 ? path : path.slice(0, query);
}

export function debugLevelFromStatus(status: number): DebugLevel | null {
	if (status >= 500) {
		return "error";
	}
	if (status >= 400) {
		return "warning";
	}
	return null;
}

export function shouldPublishDebugPath(path: string): boolean {
	const normalized = normalizeDebugPath(path);
	if (normalized === "/health") {
		return false;
	}
	return normalized !== DEBUG_PATH && !normalized.startsWith(`${DEBUG_PATH}/`);
}

export function redactDebugMessage(message: string): string {
	return message
		.replace(/gh[psu]_[A-Za-z0-9_]+/g, "[redacted]")
		.replace(/\bgpio_[A-Za-z0-9_-]+/g, "[redacted]")
		.replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]");
}

export function isAllowedDebugOrigin(
	origin: string,
	dashboardUrl?: string,
): boolean {
	const value = origin.trim();
	if (!value) {
		return true;
	}
	try {
		const url = new URL(value);
		const host = url.hostname.toLowerCase();
		if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
			return true;
		}
		if (url.origin === DEFAULT_DASHBOARD_ORIGIN) {
			return true;
		}
		if (dashboardUrl) {
			const allowed = new URL(dashboardUrl);
			if (url.origin === allowed.origin) {
				return true;
			}
		}
	} catch {
		return false;
	}
	return false;
}

export function debugWsUrl(deviceUrl: string): string {
	const origin = deviceUrl.replace(/\/+$/, "");
	if (origin.startsWith("https://")) {
		return `wss://${origin.slice("https://".length)}${DEBUG_PATH}`;
	}
	if (origin.startsWith("http://")) {
		return `ws://${origin.slice("http://".length)}${DEBUG_PATH}`;
	}
	return `wss://${origin}${DEBUG_PATH}`;
}

export function debugAuthQuery(headers: DeviceAuthHeaders): string {
	const params = new URLSearchParams();
	params.set(DEVICE_AUTH_HEADERS.keyId, headers["X-Gpio-Key-Id"]);
	params.set(DEVICE_AUTH_HEADERS.timestamp, headers["X-Gpio-Timestamp"]);
	params.set(DEVICE_AUTH_HEADERS.nonce, headers["X-Gpio-Nonce"]);
	params.set(DEVICE_AUTH_HEADERS.signature, headers["X-Gpio-Signature"]);
	return params.toString();
}

export function debugWsConnectUrl(
	deviceUrl: string,
	headers: DeviceAuthHeaders,
): string {
	return `${debugWsUrl(deviceUrl)}?${debugAuthQuery(headers)}`;
}

export function debugAuthHeadersFromSearch(search: URLSearchParams): Headers {
	const headers = new Headers();
	for (const name of Object.values(DEVICE_AUTH_HEADERS)) {
		const value = search.get(name);
		if (value) {
			headers.set(name, value);
		}
	}
	return headers;
}

export type DebugProbe = {
	status: number;
	error: string;
	ready: boolean;
};

export function parseDebugProbe(status: number, text: string): DebugProbe {
	const trimmed = text.trim();
	let error = trimmed || `device ${status}`;
	try {
		const json = JSON.parse(trimmed) as { error?: unknown };
		if (typeof json.error === "string" && json.error.trim()) {
			error = json.error.trim();
		}
	} catch {
		// keep text
	}
	return {
		status,
		error,
		ready: status === 400 && error === DEBUG_UPGRADE_FAILED,
	};
}

export function debugProbeMessage(probe: DebugProbe): string {
	if (probe.ready) {
		return "";
	}
	if (probe.status === 404 && probe.error === "not found") {
		return "Companion firmware is too old for debug. SSH: sudo gpio-companion-update";
	}
	if (probe.status === 401 && probe.error === "missing device signature") {
		return "Companion firmware is too old for debug. SSH: sudo gpio-companion-update";
	}
	if (!probe.status) {
		return probe.error;
	}
	return `${probe.status} ${probe.error}`;
}

export function debugAuthHeadersFromRequest(request: Request): Headers {
	const headers = debugAuthHeadersFromSearch(new URL(request.url).searchParams);
	for (const name of Object.values(DEVICE_AUTH_HEADERS)) {
		if (!headers.get(name)) {
			const value = request.headers.get(name);
			if (value) {
				headers.set(name, value);
			}
		}
	}
	return headers;
}

export function parseDebugEvent(value: unknown): DebugEvent | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (record.level !== "error" && record.level !== "warning") {
		return null;
	}
	if (typeof record.t !== "number" || !Number.isFinite(record.t)) {
		return null;
	}
	if (typeof record.method !== "string" || !record.method.trim()) {
		return null;
	}
	if (typeof record.path !== "string" || !record.path.trim()) {
		return null;
	}
	if (typeof record.status !== "number" || !Number.isFinite(record.status)) {
		return null;
	}
	if (typeof record.message !== "string") {
		return null;
	}
	return {
		t: record.t,
		level: record.level,
		method: record.method,
		path: record.path,
		status: record.status,
		message: record.message,
	};
}

export function parseLivePingUuid(input: unknown): string {
	if (!input || typeof input !== "object") {
		throw new Error("uuid is required");
	}
	const uuid = (input as { uuid?: unknown }).uuid;
	if (typeof uuid !== "string" || !uuid.trim()) {
		throw new Error("uuid is required");
	}
	return uuid.trim();
}

export function liveDeviceUrl(uuid: string): string {
	return publicDeviceUrl(tunnelHostnames(uuid).apiHostname);
}

export function isLiveSeen(seenAt: number, now = Date.now()): boolean {
	return now - seenAt < DEBUG_LIVE_TTL_SEC * 1000;
}
