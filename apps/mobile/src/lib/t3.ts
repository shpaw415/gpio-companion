export function t3AppUrl(uuid: string) {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return "";
	}
	return `https://t3-${trimmed.replace(/-/g, "")}.gpio-companion.com`;
}

export function t3IframeSrc(uuid: string, token = "") {
	const origin = t3AppUrl(uuid);
	const trimmed = token.trim();
	if (!origin) {
		return "";
	}
	if (!trimmed) {
		return origin;
	}
	const encoded = encodeURIComponent(trimmed);
	return `${origin}/pair?token=${encoded}#token=${encoded}`;
}

export function tokenFromPairing(status?: {
	pairingToken?: string;
	pairingUrl?: string;
}): string {
	const direct = status?.pairingToken?.trim() ?? "";
	if (direct) {
		return direct;
	}
	const url = status?.pairingUrl ?? "";
	const match = url.match(/[#?&]token=([^&\s#]+)/);
	if (!match?.[1]) {
		return "";
	}
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}
