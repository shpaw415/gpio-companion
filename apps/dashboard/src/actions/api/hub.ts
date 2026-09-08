"no action";

import { HUB_PATH } from "gpio-companion";
import {
	assertHubDashboardAccess,
	issueHubCredentials,
	verifyHubAccessTicket,
} from "../../lib/hub-credentials.ts";
import { requireIdentity } from "../../lib/session.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	DEVICE_HUB: DurableObjectNamespace;
};

type HubContext = {
	env: PagesEnv;
	request: Request;
};

export async function onRequest(ctx: HubContext) {
	if (ctx.request.method === "POST") {
		return mintTicket(ctx);
	}
	if (ctx.request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
		return upgradeHub(ctx);
	}
	return Response.json({ error: "expected websocket" }, { status: 426 });
}

async function mintTicket(ctx: HubContext) {
	let body: { uuid?: string; key?: string } = {};
	try {
		body = (await ctx.request.json()) as { uuid?: string; key?: string };
	} catch {
		return Response.json({ error: "invalid json" }, { status: 400 });
	}
	try {
		const creds = await issueHubCredentials(
			ctx.env,
			body.uuid ?? "",
			body.key ?? "",
			new URL(ctx.request.url).origin,
		);
		return Response.json(creds);
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "request failed";
		const status = message === "pairing key mismatch" ? 403 : 400;
		return Response.json({ error: message }, { status });
	}
}

async function upgradeHub(ctx: HubContext) {
	const url = new URL(ctx.request.url);
	const uuid = url.searchParams.get("uuid")?.trim() ?? "";
	const ticket = url.searchParams.get("ticket")?.trim() ?? "";
	if (!uuid) {
		return Response.json({ error: "uuid is required" }, { status: 400 });
	}
	if (!ctx.env.DEVICE_HUB) {
		return Response.json({ error: "hub is not bound" }, { status: 503 });
	}
	try {
		if (ticket) {
			const claims = await verifyHubAccessTicket(ctx.env, ticket, uuid);
			return forwardHub(ctx, uuid, claims.role);
		}
		const identity = await requireIdentity(ctx);
		await assertHubDashboardAccess(ctx.env, identity, uuid);
		return forwardHub(ctx, uuid, "dashboard");
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "request failed";
		const status =
			message === "sign in first" || message.includes("invalid hub token")
				? 401
				: message === "pairing key mismatch" ||
						message === "device is not paired with this account" ||
						message === "admin only"
					? 403
					: 400;
		return Response.json({ error: message }, { status });
	}
}

function forwardHub(ctx: HubContext, uuid: string, role: "pi" | "dashboard") {
	const id = ctx.env.DEVICE_HUB.idFromName(uuid);
	const stub = ctx.env.DEVICE_HUB.get(id);
	const forward = new URL(ctx.request.url);
	forward.pathname = HUB_PATH;
	forward.search = "";
	forward.searchParams.set("uuid", uuid);
	forward.searchParams.set("role", role);
	return stub.fetch(new Request(forward, ctx.request));
}
