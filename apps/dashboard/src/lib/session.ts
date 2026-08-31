import { createClient } from "../auth.ts";
import {
	resolveUserIdentity,
	type SignedInIdentity,
	type UserIdentity,
} from "./auth/identity.ts";
import { isAdmin } from "./auth/role.ts";

type SessionContext = {
	request: { headers: { get(name: string): string | null } };
	env: unknown;
};

export async function requireIdentity(
	ctx: SessionContext,
): Promise<SignedInIdentity> {
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
	return identity as SignedInIdentity;
}

export function requireAdmin(identity: UserIdentity): SignedInIdentity {
	if (!identity.id) {
		throw new Error("sign in first");
	}
	if (!isAdmin(identity.role)) {
		throw new Error("admin only");
	}
	return identity as SignedInIdentity;
}
