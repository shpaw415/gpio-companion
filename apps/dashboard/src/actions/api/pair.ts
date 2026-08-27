import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
};

export type StoredPairing = {
	userId: string;
	uuid: string;
	deviceUrl: string;
	giteaLogin: string;
	email: string;
	claimedAt: string;
};

export async function GET(userId: string) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	if (!userId) {
		return { paired: false as const };
	}
	const raw = await ctx.env.DYNAMIC_PAGE_KV.get(`device:${userId}`);
	if (!raw) {
		return { paired: false as const };
	}
	return { paired: true as const, device: JSON.parse(raw) as StoredPairing };
}

export async function POST(pairing: StoredPairing) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	if (!pairing.userId || !pairing.uuid) {
		throw new Error("userId and uuid are required");
	}
	await ctx.env.DYNAMIC_PAGE_KV.put(
		`device:${pairing.userId}`,
		JSON.stringify(pairing),
	);
	await ctx.env.DYNAMIC_PAGE_KV.put(`pair:${pairing.uuid}`, pairing.userId);
	return { ok: true as const, giteaLogin: pairing.giteaLogin };
}
