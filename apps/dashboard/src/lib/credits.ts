import {
	formatUsd,
	hashAiKey,
	LEGACY_CREDIT_MICROS,
	microsToUsd,
	usdToMicros,
} from "gpio-companion";

const CREDITS_VERSION = 2;

type CreditsRecord = {
	v: number;
	micros: number;
};

function serializeCredits(micros: number): string {
	const record: CreditsRecord = {
		v: CREDITS_VERSION,
		micros: Math.max(0, Math.floor(micros)),
	};
	return JSON.stringify(record);
}

export function parseCreditsRecord(raw: string | null): {
	micros: number;
	dirty: boolean;
} {
	if (!raw) {
		return { micros: 0, dirty: false };
	}
	try {
		const parsed = JSON.parse(raw) as CreditsRecord;
		if (
			parsed &&
			parsed.v === CREDITS_VERSION &&
			Number.isFinite(parsed.micros)
		) {
			return { micros: Math.max(0, Math.floor(parsed.micros)), dirty: false };
		}
	} catch {
		// legacy integer credits
	}
	const legacy = Number(raw);
	if (Number.isFinite(legacy) && legacy > 0) {
		return {
			micros: Math.floor(legacy) * LEGACY_CREDIT_MICROS,
			dirty: true,
		};
	}
	return { micros: 0, dirty: false };
}

async function putCredits(
	kv: KVNamespace,
	userId: string,
	micros: number,
): Promise<number> {
	const next = Math.max(0, Math.floor(micros));
	await kv.put(`credits:${userId}`, serializeCredits(next));
	return next;
}

export async function creditsBalance(
	kv: KVNamespace,
	userId: string,
): Promise<number> {
	const parsed = parseCreditsRecord(await kv.get(`credits:${userId}`));
	if (parsed.dirty) {
		return putCredits(kv, userId, parsed.micros);
	}
	return parsed.micros;
}

export async function grantUsd(
	kv: KVNamespace,
	userId: string,
	usd: number,
): Promise<number> {
	const grant = usdToMicros(usd);
	const next = (await creditsBalance(kv, userId)) + grant;
	return putCredits(kv, userId, next);
}

export async function grantCredits(
	kv: KVNamespace,
	userId: string,
	usd: number,
): Promise<number> {
	return grantUsd(kv, userId, usd);
}

export async function consumeMicrodollars(
	kv: KVNamespace,
	userId: string,
	amount: number,
): Promise<number | null> {
	const debit = Math.max(0, Math.floor(amount));
	const current = await creditsBalance(kv, userId);
	if (current <= 0) {
		return null;
	}
	if (debit <= 0) {
		return current;
	}
	return putCredits(kv, userId, Math.max(0, current - debit));
}

export function creditsView(micros: number): { micros: number; usd: number } {
	return { micros, usd: microsToUsd(micros) };
}

export { formatUsd, microsToUsd };

export async function registerAiKey(
	kv: KVNamespace,
	userId: string,
	gpioAiKey: string,
): Promise<void> {
	const key = gpioAiKey.trim();
	if (!key) {
		return;
	}
	const hash = await hashAiKey(key);
	await kv.put(`ai:${hash}`, userId);
}

export async function userIdForAiKey(
	kv: KVNamespace,
	gpioAiKey: string,
): Promise<string | null> {
	const key = gpioAiKey.trim();
	if (!key) {
		return null;
	}
	return kv.get(`ai:${await hashAiKey(key)}`);
}
