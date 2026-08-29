import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { giteaLoginFromEmail } from "gpio-companion";
import {
	readDeviceJson,
	signDeviceEnvelope,
	signedDeviceFetch,
} from "../../lib/device-api.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type StoredPairing = {
	userId: string;
	uuid: string;
	key: string;
	deviceUrl: string;
	giteaLogin: string;
	email: string;
	claimedAt: string;
};

export type PendingPairing = {
	uuid: string;
	key: string;
	requesterId: string;
	requesterEmail: string;
	giteaLogin: string;
	createdAt: string;
};

export type ClaimInput = {
	deviceUrl?: string;
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

export async function PUT() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	await requireIdentity(ctx);
	return signDeviceEnvelope(ctx.env, "GET", "/v1/pairing/credentials");
}

export async function POST(input: ClaimInput) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id || !input.uuid || !input.key) {
		throw new Error("uuid and key are required");
	}
	const origin = (input.deviceUrl ?? "").replace(/\/+$/, "");
	const giteaLogin =
		input.giteaLogin?.trim() ||
		giteaLoginFromEmail(identity.email ?? "") ||
		identity.id;
	const ownerId = await ctx.env.DYNAMIC_PAGE_KV.get(
		`pair:${input.uuid.trim()}`,
	);
	if (ownerId && ownerId !== identity.id) {
		const pending: PendingPairing = {
			uuid: input.uuid.trim(),
			key: input.key,
			requesterId: identity.id,
			requesterEmail: identity.email ?? "",
			giteaLogin,
			createdAt: new Date().toISOString(),
		};
		await ctx.env.DYNAMIC_PAGE_KV.put(
			`pending:${pending.uuid}`,
			JSON.stringify(pending),
		);
		const inboxKey = `inbox:${ownerId}`;
		const inboxRaw = await ctx.env.DYNAMIC_PAGE_KV.get(inboxKey);
		const inbox = inboxRaw ? (JSON.parse(inboxRaw) as string[]) : [];
		if (!inbox.includes(pending.uuid)) {
			inbox.push(pending.uuid);
			await ctx.env.DYNAMIC_PAGE_KV.put(inboxKey, JSON.stringify(inbox));
		}
		return { pending: true as const, uuid: pending.uuid };
	}
	if (origin) {
		await readDeviceJson(
			await signedDeviceFetch(ctx.env, origin, "POST", "/v1/pairing/claim", {
				uuid: input.uuid,
				key: input.key,
				userId: identity.id,
				email: identity.email ?? "",
				giteaLogin,
			}),
		);
	}
	const pairing: StoredPairing = {
		userId: identity.id,
		uuid: input.uuid.trim(),
		key: input.key,
		deviceUrl: origin,
		giteaLogin,
		email: identity.email ?? "",
		claimedAt: new Date().toISOString(),
	};
	await ctx.env.DYNAMIC_PAGE_KV.put(
		`device:${identity.id}`,
		JSON.stringify(pairing),
	);
	await ctx.env.DYNAMIC_PAGE_KV.put(`pair:${pairing.uuid}`, pairing.userId);
	if (!origin) {
		const envelope = await signDeviceEnvelope(
			ctx.env,
			"POST",
			"/v1/pairing/claim",
			{
				uuid: pairing.uuid,
				key: input.key,
				userId: identity.id,
				email: identity.email ?? "",
				giteaLogin,
			},
		);
		return {
			ok: true as const,
			pending: false as const,
			needsBle: true as const,
			giteaLogin: pairing.giteaLogin,
			deviceUrl: origin,
			envelope,
		};
	}
	return {
		ok: true as const,
		pending: false as const,
		needsBle: false as const,
		giteaLogin: pairing.giteaLogin,
		deviceUrl: origin,
	};
}

export async function DELETE() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const raw = await ctx.env.DYNAMIC_PAGE_KV.get(`device:${identity.id}`);
	if (!raw) {
		return { ok: true as const };
	}
	const device = JSON.parse(raw) as StoredPairing;
	if (device.deviceUrl) {
		await readDeviceJson(
			await signedDeviceFetch(
				ctx.env,
				device.deviceUrl,
				"POST",
				"/v1/pairing/unpair",
				{ uuid: device.uuid, key: device.key },
			),
		).catch(() => undefined);
	}
	await ctx.env.DYNAMIC_PAGE_KV.delete(`device:${identity.id}`);
	await ctx.env.DYNAMIC_PAGE_KV.delete(`pair:${device.uuid}`);
	return { ok: true as const };
}
