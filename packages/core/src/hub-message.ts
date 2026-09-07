import type { FlashStatus } from "./flash.ts";
import type { GpioSnapshot } from "./gpio.ts";

export const HUB_PATH = "/api/hub";
export const HUB_TOKEN_PREFIX = "gpiohub.v1.";
export const HUB_TOKEN_TTL_MS = 60 * 60 * 1000;
export const HUB_PING_MS = 60_000;
export const HUB_GPIO_MS = 1_000;
export const HUB_FLASH_MS = 1_500;
export const HUB_T3_MS = 3_000;
export const HUB_LIVE_TTL_SEC = 120;

export type HubRole = "pi" | "dashboard";

export type HubChannel = "gpio" | "flash" | "t3";

export type HubMessageType = HubChannel | "hello" | "ping";

export type HubT3Status = {
	running: boolean;
	pairingUrl: string;
	pairingToken: string;
	paired: boolean;
	serviceInstalled: boolean;
};

export type HubMessage = {
	v: 1;
	type: HubMessageType;
	payload?: unknown;
};

const CHANNELS = new Set<HubChannel>(["gpio", "flash", "t3"]);
const MESSAGE_TYPES = new Set<HubMessageType>([
	"gpio",
	"flash",
	"t3",
	"hello",
	"ping",
]);

export function isHubChannel(value: unknown): value is HubChannel {
	return typeof value === "string" && CHANNELS.has(value as HubChannel);
}

export function isHubRole(value: unknown): value is HubRole {
	return value === "pi" || value === "dashboard";
}

export function hubOrigin(origin?: string): string {
	return (origin || "https://gpio-companion.com").replace(/\/+$/, "");
}

export function hubWsUrl(
	origin: string,
	uuid: string,
	ticket?: string,
): string {
	const url = new URL(`${hubOrigin(origin)}${HUB_PATH}`);
	if (url.protocol === "https:") {
		url.protocol = "wss:";
	} else if (url.protocol === "http:") {
		url.protocol = "ws:";
	}
	url.searchParams.set("uuid", uuid.trim());
	if (ticket?.trim()) {
		url.searchParams.set("ticket", ticket.trim());
	}
	return url.toString();
}

export function encodeHubMessage(message: HubMessage): string {
	return JSON.stringify(message);
}

export function parseHubMessage(input: unknown): HubMessage | null {
	let value = input;
	if (typeof input === "string") {
		try {
			value = JSON.parse(input) as unknown;
		} catch {
			return null;
		}
	}
	if (!value || typeof value !== "object") {
		return null;
	}
	const record = value as { v?: unknown; type?: unknown; payload?: unknown };
	if (record.v !== 1) {
		return null;
	}
	if (
		typeof record.type !== "string" ||
		!MESSAGE_TYPES.has(record.type as HubMessageType)
	) {
		return null;
	}
	const message: HubMessage = { v: 1, type: record.type as HubMessageType };
	if (record.payload !== undefined) {
		message.payload = record.payload;
	}
	return message;
}

export function asGpioSnapshot(payload: unknown): GpioSnapshot | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const record = payload as GpioSnapshot;
	if (record.hardware !== "raspberrypi" && record.hardware !== "orangepi") {
		return null;
	}
	if (!Array.isArray(record.pins)) {
		return null;
	}
	return record;
}

export function asFlashStatus(payload: unknown): FlashStatus | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const record = payload as FlashStatus;
	if (typeof record.running !== "boolean") {
		return null;
	}
	if (
		record.last !== null &&
		record.last !== undefined &&
		typeof record.last !== "object"
	) {
		return null;
	}
	return record;
}

export function asHubT3Status(payload: unknown): HubT3Status | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const record = payload as HubT3Status;
	if (typeof record.paired !== "boolean") {
		return null;
	}
	return {
		running: Boolean(record.running),
		pairingUrl: typeof record.pairingUrl === "string" ? record.pairingUrl : "",
		pairingToken:
			typeof record.pairingToken === "string" ? record.pairingToken : "",
		paired: record.paired,
		serviceInstalled: Boolean(record.serviceInstalled),
	};
}
