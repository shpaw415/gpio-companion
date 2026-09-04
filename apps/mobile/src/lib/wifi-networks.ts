export const MANUAL_NETWORK = "manual";
export const WIFI_NETWORKS_MAX = 20;

export type SavedNetwork = {
	ssid: string;
	psk: string;
};

export function networkValue(ssid: string) {
	return `ssid:${ssid}`;
}

export function ssidFromValue(value: string) {
	return value.startsWith("ssid:") ? value.slice(5) : value;
}

export function parseSavedNetworks(raw: string | null): SavedNetwork[] {
	if (!raw) {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.flatMap((item) => {
			if (
				!item ||
				typeof item !== "object" ||
				typeof (item as SavedNetwork).ssid !== "string"
			) {
				return [];
			}
			const ssid = (item as SavedNetwork).ssid.trim();
			if (!ssid) {
				return [];
			}
			const psk =
				typeof (item as SavedNetwork).psk === "string"
					? (item as SavedNetwork).psk
					: "";
			return [{ ssid, psk }];
		});
	} catch {
		return [];
	}
}

export function upsertSavedNetwork(
	list: SavedNetwork[],
	ssid: string,
	psk: string,
): SavedNetwork[] {
	const trimmed = ssid.trim();
	if (!trimmed) {
		return list;
	}
	const next = list.filter((network) => network.ssid !== trimmed);
	next.unshift({ ssid: trimmed, psk });
	return next.slice(0, WIFI_NETWORKS_MAX);
}

export function serializeSavedNetworks(list: SavedNetwork[]) {
	return JSON.stringify(list);
}
