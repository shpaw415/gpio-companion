export const TUNNEL_ZONE = "gpio-companion.com";
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
		matches.find(
			(url) =>
				url.includes("pair") ||
				url.includes("t3.codes") ||
				url.includes(":3773"),
		) ??
		matches[0] ??
		""
	);
}

export function rewriteT3PairingUrl(raw: string, t3Hostname: string): string {
	const httpsHost = originFromHostname(t3Hostname);
	if (!httpsHost) {
		return raw.trim();
	}
	const token = extractPairingToken(raw);
	const hash = token ? `#token=${encodeURIComponent(token)}` : "";
	return `https://app.t3.codes/pair?host=${encodeURIComponent(httpsHost)}${hash}`;
}

function originFromHostname(hostname: string): string {
	const host = hostname.trim().replace(/\/+$/, "");
	if (!host) {
		return "";
	}
	if (host.startsWith("http://") || host.startsWith("https://")) {
		return host;
	}
	return `https://${host}`;
}

function extractPairingToken(raw: string): string {
	const hashMatch = raw.match(/[#?&]token=([^&\s#]+)/);
	if (hashMatch?.[1]) {
		return decodeURIComponent(hashMatch[1]);
	}
	try {
		return new URL(raw).searchParams.get("token") ?? "";
	} catch {
		return "";
	}
}
