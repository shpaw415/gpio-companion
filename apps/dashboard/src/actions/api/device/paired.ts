"no action";

import { isPairedUuid } from "../../../lib/pairing-store.ts";

type PagesEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
};

export async function onRequestGet(ctx: { env: PagesEnv; request: Request }) {
	const uuid = new URL(ctx.request.url).searchParams.get("uuid")?.trim() ?? "";
	if (!uuid) {
		return Response.json({ error: "uuid is required" }, { status: 400 });
	}
	const paired = await isPairedUuid(ctx.env.DYNAMIC_PAGE_KV, uuid);
	return Response.json(
		{ paired },
		{ headers: { "cache-control": "no-store" } },
	);
}
