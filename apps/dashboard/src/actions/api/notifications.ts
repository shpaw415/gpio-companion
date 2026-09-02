import { getContext } from "frame-master-plugin-cloudflare-pages-functions-action/context";
import { wrapAction } from "../../lib/action.ts";
import { readDeviceJson, signedDeviceFetch } from "../../lib/device-api.ts";
import {
	requireOwnedDevice,
	transferDeviceRecord,
} from "../../lib/pairing-store.ts";
import { requireIdentity } from "../../lib/session.ts";
import { type PendingPairing, parsePendingPairing } from "./pair.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

async function loadInbox(
	env: PagesEnv,
	userId: string,
): Promise<PendingPairing[]> {
	const inboxRaw = await env.DYNAMIC_PAGE_KV.get(`inbox:${userId}`);
	const ids = inboxRaw ? (JSON.parse(inboxRaw) as string[]) : [];
	const items: PendingPairing[] = [];
	for (const uuid of ids) {
		const raw = await env.DYNAMIC_PAGE_KV.get(`pending:${uuid}`);
		if (raw) {
			items.push(parsePendingPairing(raw));
		}
	}
	return items;
}

export const GET = wrapAction(async function GET() {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const items = await loadInbox(ctx.env, identity.id);
	return { items };
});

export const POST = wrapAction(async function POST(input: {
	uuid: string;
	action: "accept" | "reject";
}) {
	const ctx = getContext<PagesEnv, never, never>(arguments);
	const identity = await requireIdentity(ctx);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	const uuid = input.uuid.trim();
	const pendingRaw = await ctx.env.DYNAMIC_PAGE_KV.get(`pending:${uuid}`);
	if (!pendingRaw) {
		throw new Error("pending pairing not found");
	}
	const pending = JSON.parse(pendingRaw) as PendingPairing;
	if (input.action === "reject") {
		await ctx.env.DYNAMIC_PAGE_KV.delete(`pending:${uuid}`);
		await removeInbox(ctx.env, identity.id, uuid);
		return { ok: true as const, action: "reject" as const };
	}
	const owner = await requireOwnedDevice(
		ctx.env.DYNAMIC_PAGE_KV,
		identity.id,
		uuid,
	).catch(() => {
		throw new Error("you do not own this board");
	});
	if (owner.deviceUrl) {
		await readDeviceJson(
			await signedDeviceFetch(
				ctx.env,
				owner.deviceUrl,
				"POST",
				"/v1/pairing/transfer",
				{
					uuid,
					key: pending.key,
					userId: pending.requesterId,
					email: pending.requesterEmail,
					login: pending.login,
				},
			),
		);
	}
	await transferDeviceRecord(ctx.env.DYNAMIC_PAGE_KV, owner, {
		userId: pending.requesterId,
		email: pending.requesterEmail,
		login: pending.login,
		key: pending.key,
	});
	return { ok: true as const, action: "accept" as const };
});

async function removeInbox(env: PagesEnv, userId: string, uuid: string) {
	const inboxRaw = await env.DYNAMIC_PAGE_KV.get(`inbox:${userId}`);
	const inbox = inboxRaw ? (JSON.parse(inboxRaw) as string[]) : [];
	await env.DYNAMIC_PAGE_KV.put(
		`inbox:${userId}`,
		JSON.stringify(inbox.filter((id) => id !== uuid)),
	);
}
