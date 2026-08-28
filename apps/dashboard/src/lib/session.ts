import { createClient } from "../auth.ts";
import { ACCESS_TOKEN_COOKIE } from "./auth/access-token-cookie.ts";
import { resolveUserIdentity, type UserIdentity } from "./auth/identity.ts";

type SessionContext = {
	request: { headers: { get(name: string): string | null } };
	env: unknown;
};

function cookieValue(
	request: { headers: { get(name: string): string | null } },
	name: string,
): string {
	const cookie = request.headers.get("cookie") ?? "";
	const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match?.[1] ? decodeURIComponent(match[1]) : "";
}

export async function requireIdentity(
	ctx: SessionContext,
): Promise<UserIdentity> {
	const auth = createClient({
		ctx: ctx as never,
	});
	const token = cookieValue(ctx.request, ACCESS_TOKEN_COOKIE);
	const withToken = auth as { setToken?: (value: string) => void };
	if (token && typeof withToken.setToken === "function") {
		withToken.setToken(token);
	}
	try {
		await auth.init();
	} catch {
		// cookie token may already be enough for getUserSession
	}
	const identity = await resolveUserIdentity(auth);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	return identity;
}
