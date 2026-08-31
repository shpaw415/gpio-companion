import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import {
	loginFromEmail,
	publicDeviceUrl,
	tunnelHostnames,
} from "gpio-companion";
import { wrapAction } from "../../lib/action.ts";
import { registerAiKey } from "../../lib/credits.ts";
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
	login: string;
	email: string;
	claimedAt: string;
};

export type PendingPairing = {
	uuid: string;
	key: string;
	requesterId: string;
	requesterEmail: string;
	login: string;
	createdAt: string;
};

export type ClaimInput = {
	deviceUrl?: string;
	uuid: string;
	key: string;
};

export function parseStoredPairing(raw: string): StoredPairing {
	const parsed = JSON.parse(raw) as StoredPairing & { giteaLogin?: string };
	return { ...parsed, login: parsed.login || parsed.giteaLogin || "" };
}

export function parsePendingPairing(raw: string): PendingPairing {
	const parsed = JSON.parse(raw) as PendingPairing & { giteaLogin?: string };
	return { ...parsed, login: parsed.login || parsed.giteaLogin || "" };
}

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	const raw = await ctx.env.DYNAMIC_PAGE_KV.get(`device:${identity.id}`);
	if (!raw) {
		return { paired: false as const };
	}
	return { paired: true as const, device: parseStoredPairing(raw) };
});

export const PUT = wrapAction(async function PUT() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	await requireIdentity(ctx);
	return signDeviceEnvelope(ctx.env, "GET", "/v1/pairing/credentials");
});

export const POST = wrapAction(async function POST(input: ClaimInput) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id || !input.uuid || !input.key) {
		throw new Error("uuid and key are required");
	}
	const hosts = tunnelHostnames(input.uuid.trim());
	const typedOrigin = (input.deviceUrl ?? "").replace(/\/+$/, "");
	const origin = typedOrigin || publicDeviceUrl(hosts.apiHostname);
	const login = loginFromEmail(identity.email ?? "") || identity.id;
	const ownerId = await ctx.env.DYNAMIC_PAGE_KV.get(
		`pair:${input.uuid.trim()}`,
	);
	if (ownerId && ownerId !== identity.id) {
		const pending: PendingPairing = {
			uuid: input.uuid.trim(),
			key: input.key,
			requesterId: identity.id,
			requesterEmail: identity.email ?? "",
			login,
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
	let needsBle = false;
	if (origin) {
		try {
			await readDeviceJson(
				await signedDeviceFetch(ctx.env, origin, "POST", "/v1/pairing/claim", {
					uuid: input.uuid,
					key: input.key,
					userId: identity.id,
					email: identity.email ?? "",
					login,
				}),
			);
		} catch (error) {
			if (typedOrigin) {
				throw error;
			}
			needsBle = true;
		}
	} else {
		needsBle = true;
	}
	const pairing: StoredPairing = {
		userId: identity.id,
		uuid: input.uuid.trim(),
		key: input.key,
		deviceUrl: origin,
		login,
		email: identity.email ?? "",
		claimedAt: new Date().toISOString(),
	};
	await ctx.env.DYNAMIC_PAGE_KV.put(
		`device:${identity.id}`,
		JSON.stringify(pairing),
	);
	await ctx.env.DYNAMIC_PAGE_KV.put(`pair:${pairing.uuid}`, pairing.userId);
	if (!needsBle && origin) {
		await registerDeviceAiKey(ctx.env, origin, identity.id);
	}
	if (needsBle) {
		const envelope = await signDeviceEnvelope(
			ctx.env,
			"POST",
			"/v1/pairing/claim",
			{
				uuid: pairing.uuid,
				key: input.key,
				userId: identity.id,
				email: identity.email ?? "",
				login,
			},
		);
		return {
			ok: true as const,
			pending: false as const,
			needsBle: true as const,
			login: pairing.login,
			deviceUrl: origin,
			t3Hostname: hosts.t3Hostname,
			envelope,
		};
	}
	return {
		ok: true as const,
		pending: false as const,
		needsBle: false as const,
		login: pairing.login,
		deviceUrl: origin,
		t3Hostname: hosts.t3Hostname,
	};
});

export const DELETE = wrapAction(async function DELETE() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const raw = await ctx.env.DYNAMIC_PAGE_KV.get(`device:${identity.id}`);
	if (!raw) {
		return { ok: true as const };
	}
	const device = parseStoredPairing(raw);
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
});

export async function registerDeviceAiKey(
	env: PagesEnv,
	origin: string,
	userId: string,
): Promise<void> {
	try {
		const payload = await readDeviceJson<{ gpioAiKey?: string }>(
			await signedDeviceFetch(env, origin, "GET", "/v1/config/ai-key"),
		);
		await registerAiKey(env.DYNAMIC_PAGE_KV, userId, payload.gpioAiKey ?? "");
	} catch {
		return;
	}
}
