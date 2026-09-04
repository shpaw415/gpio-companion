export type NetworkStatus = {
	type?: "ethernet" | "wifi" | "unknown";
	ssid?: string;
	interface?: string;
	connection?: string;
};

export function formatNetworkLabel(network?: NetworkStatus | null): string {
	if (!network) {
		return "";
	}
	if (network.type === "ethernet") {
		return "Ethernet";
	}
	if (network.type === "wifi") {
		const ssid = network.ssid?.trim();
		return ssid ? `WiFi · ${ssid}` : "WiFi";
	}
	return "";
}

export function flattenDeviceInfo(
	value: unknown,
	prefix = "",
): Array<{ key: string; value: string }> {
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
