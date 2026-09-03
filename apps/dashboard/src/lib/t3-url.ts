import { publicDeviceUrl, tunnelHostnames } from "gpio-companion";

export const T3_PATH = "/devices/t3";
export const T3_EMBED_PREFIX = "/api/t3-embed";
export const T3_FRAME_SLOT_ID = "gpio-t3-frame-slot";

export function isT3Path(pathname: string): boolean {
	return pathname === T3_PATH || pathname.startsWith(`${T3_PATH}/`);
}

export function t3AppUrl(uuid: string): string {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return "";
	}
	return publicDeviceUrl(tunnelHostnames(trimmed).t3Hostname);
}

export function t3EmbedUrl(uuid: string): string {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return "";
	}
	return `${T3_EMBED_PREFIX}/${encodeURIComponent(trimmed)}/`;
}

export function parseT3EmbedPath(
	pathname: string,
): { uuid: string; rest: string } | null {
	const prefix = `${T3_EMBED_PREFIX}/`;
	if (!pathname.startsWith(prefix)) {
		return null;
	}
	const raw = pathname.slice(prefix.length);
	const slash = raw.indexOf("/");
	const encoded = slash === -1 ? raw : raw.slice(0, slash);
	let uuid = "";
	try {
		uuid = decodeURIComponent(encoded).trim();
	} catch {
		return null;
	}
	if (
		!uuid ||
		uuid.includes("/") ||
		uuid.includes("\\") ||
		uuid.includes("..")
	) {
		return null;
	}
	const rest = slash === -1 ? "/" : raw.slice(slash) || "/";
	return { uuid, rest };
}

export function rewriteT3EmbedUrl(
	value: string,
	t3Origin: string,
	embedOrigin: string,
	embedPrefix: string,
): string {
	const trimmed = value.trim();
	if (
		!trimmed ||
		trimmed.startsWith("#") ||
		trimmed.startsWith("data:") ||
		trimmed.startsWith("javascript:") ||
		trimmed.startsWith("blob:")
	) {
		return value;
	}
	const origin = t3Origin.replace(/\/+$/, "");
	const prefix = embedPrefix.replace(/\/+$/, "");
	if (trimmed.startsWith("//")) {
		const abs = `https:${trimmed}`;
		if (abs.startsWith(`${origin}/`) || abs === origin) {
			return rewriteT3EmbedUrl(abs, origin, embedOrigin, prefix);
		}
		return value;
	}
	if (trimmed.startsWith("/")) {
		return `${prefix}${trimmed}`;
	}
	try {
		const next = new URL(trimmed, `${origin}/`);
		if (next.origin === origin) {
			return `${prefix}${next.pathname}${next.search}${next.hash}`;
		}
		if (next.origin === embedOrigin && next.pathname.startsWith(`${prefix}/`)) {
			return `${next.pathname}${next.search}${next.hash}`;
		}
	} catch {
		return value;
	}
	return value;
}

export function pickT3DeviceUuid(
	devices: Array<{ uuid: string }>,
	preferred = "",
): string {
	const want = preferred.trim();
	if (want && devices.some((device) => device.uuid === want)) {
		return want;
	}
	return devices[0]?.uuid ?? "";
}
