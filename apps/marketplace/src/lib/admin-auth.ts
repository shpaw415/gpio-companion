import type { EventContext } from "@cloudflare/workers-types";
import { createCommerceDatabase } from "./db/client.ts";

/**
 * Server-side admin gate for marketplace APIs.
 *
 * Current rule (pre-OpenAuthster): allow when `MARKETPLACE_ADMIN_TOKEN` is
 * unset AND the request targets a local dev host; otherwise require a matching
 * `x-admin-token` header. UI hiding is never authorization — every admin
 * action calls this first.
 *
 * TODO: replace with OpenAuthster session + role check (dashboard client ID
 * __gpio_companion_927ffcf9) before any production traffic.
 */
export function requireAdmin(ctx: EventContext<Env, string, unknown>): void {
	const env = ctx.env as Env & { MARKETPLACE_ADMIN_TOKEN?: string };
	const configured = env.MARKETPLACE_ADMIN_TOKEN;
	if (configured) {
		if (ctx.request.headers.get("x-admin-token") === configured) return;
		throw new Error("Admin access required");
	}
	const hostname = new URL(ctx.request.url).hostname;
	if (hostname === "localhost" || hostname === "127.0.0.1") return;
	throw new Error("Admin access required (OpenAuthster sign-in not wired yet)");
}

export function commerceDb(ctx: EventContext<Env, string, unknown>) {
	const db = (ctx.env as Env).MARKETPLACE_DB;
	if (!db) throw new Error("MARKETPLACE_DB binding is missing");
	return createCommerceDatabase(db);
}
