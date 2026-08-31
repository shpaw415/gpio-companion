import { hashAiKey } from "gpio-companion";

export async function creditsBalance(
	kv: KVNamespace,
	userId: string,
): Promise<number> {
	const raw = await kv.get(`credits:${userId}`);
	const value = Number(raw ?? "0");
	return Number.isFinite(value) ? value : 0;
}

export async function grantCredits(
	kv: KVNamespace,
	userId: string,
	amount: number,
): Promise<number> {
	const next = (await creditsBalance(kv, userId)) + amount;
	await kv.put(`credits:${userId}`, String(next));
	return next;
}

export async function consumeCredit(
	kv: KVNamespace,
	userId: string,
): Promise<number | null> {
	const current = await creditsBalance(kv, userId);
	if (current <= 0) {
		return null;
	}
	const next = current - 1;
	await kv.put(`credits:${userId}`, String(next));
	return next;
}

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
