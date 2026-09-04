export const TUNNEL_ZONE = "gpio-companion.com";
export const DASHBOARD_ORIGIN = `https://${TUNNEL_ZONE}`;
export const T3_DASHBOARD_PATH = "/devices/t3";
export const T3_ORIGIN_PORT = 3773;
export const DEVICE_API_PORT = 4150;

export type TunnelHostnames = {
	slug: string;
	t3Hostname: string;
	apiHostname: string;
};

export function pairingSlug(uuid: string): string {
	return uuid.trim().replaceAll("-", "").toLowerCase();
}

export function tunnelHostnames(
	uuid: string,
	zone = TUNNEL_ZONE,
): TunnelHostnames {
	const slug = pairingSlug(uuid);
	return {
		slug,
		t3Hostname: `t3-${slug}.${zone}`,
		apiHostname: `api-${slug}.${zone}`,
	};
}

export function cloudflareTunnelName(uuid: string): string {
	return `gpio-${uuid.trim()}`;
}

export function publicDeviceUrl(apiHostname: string): string {
	const host = apiHostname.trim().replace(/\/+$/, "");
	if (!host) {
		return "";
	}
	if (host.startsWith("http://") || host.startsWith("https://")) {
		return host;
	}
	return `https://${host}`;
}

export function extractT3PairingUrl(text: string): string {
	const matches = text.match(/https?:\/\/[^\s"'<>]+/g);
	if (!matches) {
		return "";
	}
	return (
		matches.find((url) => url.includes("/pair")) ??
		matches.find((url) => /[#?&]token=/.test(url)) ??
		matches.find((url) => url.includes("pair")) ??
		""
	);
}

export function extractT3PairingToken(text: string): string {
	const labeled = text.match(/(?:^|\n)\s*Token:\s+(\S+)/i);
	if (labeled?.[1]) {
		return stripToken(labeled[1]);
	}
	const fromUrl = extractPairingToken(extractT3PairingUrl(text) || text);
	if (fromUrl) {
		return fromUrl;
	}
	const trimmed = text.trim();
	if (trimmed.startsWith("{")) {
		try {
			const json = JSON.parse(trimmed) as {
				credential?: unknown;
				token?: unknown;
			};
			if (typeof json.credential === "string" && json.credential) {
				return json.credential;
			}
			if (typeof json.token === "string" && json.token) {
				return json.token;
			}
		} catch {
			return "";
		}
	}
	return "";
}

export function rewriteT3PairingUrl(raw: string, t3Hostname: string): string {
	return t3PairPageUrl(t3Hostname, extractT3PairingToken(raw));
}

export function t3PairPageUrl(t3Hostname: string, token: string): string {
	const origin = publicDeviceUrl(t3Hostname).replace(/\/+$/, "");
	const trimmed = token.trim();
	if (!origin || !trimmed) {
		return "";
	}
	return `${origin}/pair#token=${encodeURIComponent(trimmed)}`;
}

export function dashboardT3PairPath(uuid: string, token: string): string {
	const id = uuid.trim();
	const trimmed = token.trim();
	if (!id || !trimmed) {
		return "";
	}
	return `${T3_DASHBOARD_PATH}?uuid=${encodeURIComponent(id)}#token=${encodeURIComponent(trimmed)}`;
}

export function dashboardT3PairUrl(
	uuid: string,
	token: string,
	origin = DASHBOARD_ORIGIN,
): string {
	const path = dashboardT3PairPath(uuid, token);
	if (!path) {
		return "";
	}
	return `${origin.replace(/\/+$/, "")}${path}`;
}

export function parseDashboardT3PairLocation(
	search: string,
	hash: string,
): { uuid: string; token: string } {
	const query = search.startsWith("?") ? search.slice(1) : search;
	const params = new URLSearchParams(query);
	const uuid = params.get("uuid")?.trim() ?? "";
	const fromQuery = params.get("token")?.trim() ?? "";
	const fromHash = hash.match(/[#&?]token=([^&]+)/);
	let token = fromQuery;
	if (fromHash?.[1]) {
		try {
			token = decodeURIComponent(fromHash[1]);
		} catch {
			token = fromHash[1];
		}
	}
	return { uuid, token: stripToken(token) };
}

function extractPairingToken(raw: string): string {
	const hashMatch = raw.match(/[#?&]token=([^&\s#]+)/);
	if (hashMatch?.[1]) {
		return stripToken(decodeURIComponent(hashMatch[1]));
	}
	try {
		return stripToken(new URL(raw).searchParams.get("token") ?? "");
	} catch {
		return "";
	}
}

function stripToken(token: string): string {
	return token.replace(/[.,;]+$/, "");
}
