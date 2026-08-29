export type WifiConfig = {
	ssid: string;
	psk: string;
	uuid: string;
};

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

function requiredString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${field} is required`);
	}
	return value.trim();
}
