export const INFO_PATH = "/v1/info";

export type NetworkConnectionType = "ethernet" | "wifi" | "unknown";

export type NetworkStatus = {
	type: NetworkConnectionType;
	ssid: string;
	interface: string;
	connection: string;
};

export type DeviceInfoRow = {
	key: string;
	value: string;
};

const NETWORK_TYPES = new Set<NetworkConnectionType>([
	"ethernet",
	"wifi",
	"unknown",
]);

export function parseNetworkStatus(value: unknown): NetworkStatus | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const record = value as Record<string, unknown>;
	const type = typeof record.type === "string" ? record.type.trim() : "";
	if (!NETWORK_TYPES.has(type as NetworkConnectionType)) {
		return null;
	}
	return {
		type: type as NetworkConnectionType,
		ssid: typeof record.ssid === "string" ? record.ssid : "",
		interface: typeof record.interface === "string" ? record.interface : "",
		connection: typeof record.connection === "string" ? record.connection : "",
	};
}

export function formatNetworkLabel(
	network: NetworkStatus | null | undefined,
): string {
	if (!network) {
		return "";
	}
	if (network.type === "ethernet") {
		return "Ethernet";
	}
	if (network.type === "wifi") {
		const ssid = network.ssid.trim();
		return ssid ? `WiFi · ${ssid}` : "WiFi";
	}
	return "";
}

export function flattenDeviceInfo(
	value: unknown,
	prefix = "",
): DeviceInfoRow[] {
	if (value === null || value === undefined || value === "") {
		return prefix ? [{ key: prefix, value: "-" }] : [];
	}
	if (typeof value === "boolean") {
		return [{ key: prefix, value: value ? "yes" : "no" }];
	}
	if (typeof value !== "object") {
		return [{ key: prefix, value: String(value) }];
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return prefix ? [{ key: prefix, value: "-" }] : [];
		}
		return value.flatMap((item, index) =>
			flattenDeviceInfo(item, prefix ? `${prefix}.${index}` : String(index)),
		);
	}
	const entries = Object.entries(value);
	if (entries.length === 0) {
		return prefix ? [{ key: prefix, value: "-" }] : [];
	}
	return entries.flatMap(([key, item]) =>
		flattenDeviceInfo(item, prefix ? `${prefix}.${key}` : key),
	);
}
