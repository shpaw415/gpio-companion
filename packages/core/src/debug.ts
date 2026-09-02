export type DebugLevel = "error" | "warning";

export type DebugEvent = {
	t: number;
	level: DebugLevel;
	method: string;
	path: string;
	status: number;
	message: string;
};

export type DebugTicket = {
	ticket: string;
	expiresAt: number;
};

export const DEBUG_PATH = "/v1/debug";
export const DEBUG_TICKET_PATH = "/v1/debug/ticket";
export const DEBUG_TICKET_TTL_MS = 5 * 60 * 1000;
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
