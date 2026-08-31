"no action";

import { readDeviceJson, signedDeviceFetch } from "../../../lib/device-api.ts";
import {
	asString,
	errorStatus,
	jsonFail,
	jsonOk,
	type MobileContext,
	readJsonBody,
	requireMobileIdentity,
} from "../../../lib/mobile-http.ts";
import {
	removeDevice,
	requireOwnedDevice,
	type StoredPairing,
	upsertDevice,
} from "../../../lib/pairing-store.ts";
import { type PendingPairing, parsePendingPairing } from "../pair.ts";

async function loadInbox(
	env: MobileContext["env"],
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

async function removeInbox(
	env: MobileContext["env"],
	userId: string,
	uuid: string,
) {
	const inboxRaw = await env.DYNAMIC_PAGE_KV.get(`inbox:${userId}`);
	const inbox = inboxRaw ? (JSON.parse(inboxRaw) as string[]) : [];
	await env.DYNAMIC_PAGE_KV.put(
		`inbox:${userId}`,
		JSON.stringify(inbox.filter((id) => id !== uuid)),
	);
}

export async function onRequestGet(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		return jsonOk({ items: await loadInbox(ctx.env, identity.id) });
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}

export async function onRequestPost(ctx: MobileContext) {
	try {
		const identity = await requireMobileIdentity(ctx);
		if (!identity.id) {
			throw new Error("sign in first");
		}
		const body = await readJsonBody(ctx.request);
		const uuid = asString(body.uuid).trim();
		const action = asString(body.action);
		const pendingRaw = await ctx.env.DYNAMIC_PAGE_KV.get(`pending:${uuid}`);
		if (!pendingRaw) {
			throw new Error("pending pairing not found");
		}
		const pending = JSON.parse(pendingRaw) as PendingPairing;
		if (action === "reject") {
			await ctx.env.DYNAMIC_PAGE_KV.delete(`pending:${uuid}`);
			await removeInbox(ctx.env, identity.id, uuid);
			return jsonOk({ ok: true as const, action: "reject" as const });
		}
		if (action !== "accept") {
			throw new Error("unknown notification action");
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
		const next: StoredPairing = {
			...owner,
			userId: pending.requesterId,
			email: pending.requesterEmail,
			login: pending.login,
			key: pending.key,
			claimedAt: new Date().toISOString(),
		};
		await removeDevice(ctx.env.DYNAMIC_PAGE_KV, identity.id, uuid);
		await upsertDevice(ctx.env.DYNAMIC_PAGE_KV, next);
		await ctx.env.DYNAMIC_PAGE_KV.delete(`pending:${uuid}`);
		await removeInbox(ctx.env, identity.id, uuid);
		return jsonOk({ ok: true as const, action: "accept" as const });
	} catch (caught) {
		return jsonFail(
			caught instanceof Error ? caught.message : "request failed",
			errorStatus(caught),
		);
	}
}
