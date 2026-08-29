import { createClient } from "../auth.ts";
import { resolveUserIdentity, type UserIdentity } from "./auth/identity.ts";

type SessionContext = {
	request: { headers: { get(name: string): string | null } };
	env: unknown;
};

export async function requireIdentity(
	ctx: SessionContext,
): Promise<UserIdentity> {
	const auth = createClient({
		ctx: ctx as never,
	});
	await auth.setTokenFromRequest(ctx.request as Request);
	if (!auth.getToken()) {
		throw new Error("sign in first");
	}
	const identity = await resolveUserIdentity(auth);
	if (!identity.id) {
		throw new Error("sign in first");
	}
	return identity;
}
