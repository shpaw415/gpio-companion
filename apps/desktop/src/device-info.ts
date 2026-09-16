export type NetworkStatus = {
	type?: "ethernet" | "wifi" | "unknown";
	ssid?: string;
	interface?: string;
	connection?: string;
};

export function formatNetworkLabel(
	network?: NetworkStatus | null,
	t?: (
		key: "devices.ethernet" | "devices.wifiSsid" | "nav.wifi",
		vars?: { ssid: string },
	) => string,
): string {
	if (!network) {
		return "";
	}
	if (network.type === "ethernet") {
		return t ? t("devices.ethernet") : "Ethernet";
	}
	if (network.type === "wifi") {
		const ssid = network.ssid?.trim();
		if (ssid) {
			return t ? t("devices.wifiSsid", { ssid }) : `WiFi · ${ssid}`;
		}
		return t ? t("nav.wifi") : "WiFi";
	}
	return "";
}

export function flattenDeviceInfo(
	value: unknown,
	prefix = "",
	yes = "yes",
	no = "no",
): Array<{ key: string; value: string }> {
	if (value === null || value === undefined || value === "") {
		return prefix ? [{ key: prefix, value: "-" }] : [];
	}
	if (typeof value === "boolean") {
		return [{ key: prefix, value: value ? yes : no }];
	}
	if (typeof value !== "object") {
		return [{ key: prefix, value: String(value) }];
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return prefix ? [{ key: prefix, value: "-" }] : [];
		}
		return value.flatMap((item, index) =>
			flattenDeviceInfo(
				item,
				prefix ? `${prefix}.${index}` : String(index),
				yes,
				no,
			),
		);
	}
	const entries = Object.entries(value);
	if (entries.length === 0) {
		return prefix ? [{ key: prefix, value: "-" }] : [];
	}
	return entries.flatMap(([key, item]) =>
		flattenDeviceInfo(item, prefix ? `${prefix}.${key}` : key, yes, no),
	);
}
