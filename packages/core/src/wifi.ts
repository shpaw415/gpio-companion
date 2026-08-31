export type WifiConfig = {
	ssid: string;
	psk: string;
	uuid: string;
};

export type WifiConnectReason =
	| "ssid-not-found"
	| "password"
	| "no-device"
	| "failed";

export const WIFI_CONNECT_MESSAGES: Record<WifiConnectReason, string> = {
	"ssid-not-found": "wifi network not found",
	password: "wifi password incorrect",
	"no-device": "wifi adapter not available",
	failed: "wifi connect failed",
};

export function wifiConnectMessage(reason: WifiConnectReason): string {
	return WIFI_CONNECT_MESSAGES[reason];
}

export class WifiConnectError extends Error {
	readonly reason: WifiConnectReason;

	constructor(reason: WifiConnectReason) {
		super(wifiConnectMessage(reason));
		this.name = "WifiConnectError";
		this.reason = reason;
	}
}

export function classifyWifiConnectError(output: string): WifiConnectReason {
	const text = output.toLowerCase();
	if (
		text.includes("no network with ssid") ||
		text.includes("network could not be found") ||
		/ssid[^\n]*not found/.test(text)
	) {
		return "ssid-not-found";
	}
	if (
		text.includes("secrets were required") ||
		text.includes("psk: property is invalid") ||
		text.includes("wrong password") ||
		text.includes("bad password") ||
		text.includes("802-11-wireless-security")
	) {
		return "password";
	}
	if (
		text.includes("no suitable device") ||
		/device [^\n]* not found/.test(text) ||
		text.includes("wifi is disabled") ||
		text.includes("scanning not allowed")
	) {
		return "no-device";
	}
	return "failed";
}

export function parseWifiConfig(input: unknown): WifiConfig {
	if (input === null || typeof input !== "object") {
		throw new Error("wifi must be an object");
	}
	const record = input as Record<string, unknown>;
	return {
		ssid: requiredString(record.ssid, "ssid"),
		psk: requiredString(record.psk, "psk"),
		uuid: requiredString(record.uuid, "uuid"),
	};
}

export function publicWifiStatus(ssid: string, connected: boolean) {
	return { ssid, connected };
}

export function publicWifiFailure(ssid: string, reason: WifiConnectReason) {
	return {
		ssid,
		connected: false as const,
		reason,
		error: wifiConnectMessage(reason),
	};
}

function requiredString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${field} is required`);
	}
	return value.trim();
}
