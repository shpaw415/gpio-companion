const CREDITS_VERSION = 2;

type CreditsRecord = {
	v: number;
	micros: number;
};

export async function creditsBalance(
	kv: KVNamespace,
	userId: string,
): Promise<number> {
	const raw = await kv.get(`credits:${userId}`);
	if (!raw) {
		return 0;
	}
	try {
		const parsed = JSON.parse(raw) as CreditsRecord;
		if (
			parsed &&
			parsed.v === CREDITS_VERSION &&
			Number.isFinite(parsed.micros)
		) {
			return Math.max(0, Math.floor(parsed.micros));
		}
	} catch {
		return 0;
	}
	return 0;
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
	const next = Math.max(0, current - debit);
	await kv.put(
		`credits:${userId}`,
		JSON.stringify({
			v: CREDITS_VERSION,
			micros: next,
		} satisfies CreditsRecord),
	);
	return next;
}
