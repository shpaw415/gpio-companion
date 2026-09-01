import type { SignedInIdentity } from "./auth/identity.ts";
import { requireIdentity } from "./session.ts";

export type MobileEnv = {
	DYNAMIC_PAGE_KV: KVNamespace;
	GPIO_COMPANION_DEVICE_PRIVATE_KEY?: string;
	GPIO_COMPANION_DEVICE_KEY_ID?: string;
};

export type MobileContext = {
	request: Request;
	env: MobileEnv;
};

export function jsonOk(data: unknown, status = 200): Response {
	return Response.json({ ok: true, data }, { status });
}

export function jsonFail(error: string, status = 400): Response {
	return Response.json({ ok: false, error }, { status });
}

export function errorStatus(caught: unknown): number {
	const message = caught instanceof Error ? caught.message : "request failed";
	if (
		message === "sign in first" ||
		message.startsWith("profile unavailable")
	) {
		return 401;
	}
	if (message === "admin only") {
		return 403;
	}
	return 400;
}

export async function requireMobileIdentity(
	ctx: MobileContext,
): Promise<SignedInIdentity> {
	return requireIdentity(ctx);
}

export async function readJsonBody(
	request: Request,
): Promise<Record<string, unknown>> {
	try {
		const body = (await request.json()) as unknown;
		if (!body || typeof body !== "object" || Array.isArray(body)) {
			return {};
		}
		return body as Record<string, unknown>;
	} catch {
		return {};
	}
}

export function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}
