import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { giteaLoginFromEmail } from "gpio-companion";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type StoredPairing = {
	userId: string;
	uuid: string;
	deviceUrl: string;
	giteaLogin: string;
	email: string;
	claimedAt: string;
};

export type ClaimInput = {
	deviceUrl: string;
	uuid: string;
	key: string;
	giteaLogin?: string;
};

export async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	const raw = await ctx.env.DYNAMIC_PAGE_KV.get(`device:${identity.id}`);
	if (!raw) {
		return { paired: false as const };
	}
	return { paired: true as const, device: JSON.parse(raw) as StoredPairing };
}

export async function POST(input: ClaimInput) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	const origin = input.deviceUrl.replace(/\/+$/, "");
	if (!origin || !input.uuid || !input.key) {
		throw new Error("deviceUrl, uuid, and key are required");
	}
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const giteaLogin =
		input.giteaLogin?.trim() ||
		giteaLoginFromEmail(identity.email ?? "") ||
		identity.id;
	const claimed = await readDeviceJson<{ giteaLogin: string }>(
		await signedDeviceFetch(ctx.env, origin, "POST", "/v1/pairing/claim", {
			uuid: input.uuid,
			key: input.key,
			userId: identity.id,
			email: identity.email ?? "",
			giteaLogin,
		}),
	);
	const pairing: StoredPairing = {
		userId: identity.id,
		uuid: input.uuid.trim(),
		deviceUrl: origin,
		giteaLogin: claimed.giteaLogin || giteaLogin,
		email: identity.email ?? "",
		claimedAt: new Date().toISOString(),
	};
	await ctx.env.DYNAMIC_PAGE_KV.put(
		`device:${identity.id}`,
		JSON.stringify(pairing),
	);
	await ctx.env.DYNAMIC_PAGE_KV.put(`pair:${pairing.uuid}`, pairing.userId);
	return {
		ok: true as const,
		giteaLogin: pairing.giteaLogin,
		deviceUrl: origin,
	};
}
