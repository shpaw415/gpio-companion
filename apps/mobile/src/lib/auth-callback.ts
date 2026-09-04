export function firstParam(
	value: string | string[] | undefined,
): string | undefined {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
		return value[0];
	}
	return undefined;
}

export function queryFrom(raw: string): URLSearchParams {
	const q = raw.indexOf("?");
	if (q === -1) {
		return new URLSearchParams();
	}
	const hash = raw.indexOf("#", q);
	const query = hash === -1 ? raw.slice(q + 1) : raw.slice(q + 1, hash);
	return new URLSearchParams(query);
}

export function unwrapAuthCallbackUrl(
	raw: string | null | undefined,
	depth = 0,
): string | null {
	if (!raw || depth > 4) {
		return null;
	}
	const params = queryFrom(raw);
	if (params.get("code")) {
		return raw;
	}
	const nested = params.get("url");
	if (nested) {
		return unwrapAuthCallbackUrl(nested, depth + 1);
	}
	return null;
}

export function buildAuthCallbackUrl(
	redirectUri: string,
	code: string,
	state?: string,
): string {
	const params = new URLSearchParams({ code });
	if (state) {
		params.set("state", state);
	}
	const base = redirectUri.replace(/\?.*$/, "");
	return `${base}?${params.toString()}`;
}

export function resolveAuthCallbackUrl(input: {
	redirectUri: string;
	code?: string;
	state?: string;
	nestedUrl?: string;
	linkingUrl?: string | null;
}): string | null {
	if (input.code) {
		return buildAuthCallbackUrl(input.redirectUri, input.code, input.state);
	}
	return (
		unwrapAuthCallbackUrl(input.nestedUrl) ??
		unwrapAuthCallbackUrl(input.linkingUrl)
	);
}
