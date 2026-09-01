import { createClient } from "../auth.ts";
import {
	errorMessage,
	formatIdentityFailure,
	probeUserIdentity,
	type SignedInIdentity,
	type UserIdentity,
} from "./auth/identity.ts";
import { isAdmin } from "./auth/role.ts";

type SessionContext = {
	request: { headers: { get(name: string): string | null } };
	env: unknown;
};

function authorizationMeta(ctx: SessionContext): {
	hasBearer: boolean;
	headerBytes: number;
} {
	const header = ctx.request.headers.get("authorization") ?? "";
	return {
		hasBearer: header.toLowerCase().startsWith("bearer "),
		headerBytes: header.startsWith("Bearer ")
			? header.slice("Bearer ".length).length
			: header.length,
	};
}

export async function requireIdentity(
	ctx: SessionContext,
): Promise<SignedInIdentity> {
	const auth = createClient({
		ctx: ctx as never,
	});
	const header = authorizationMeta(ctx);
	try {
		await auth.setTokenFromRequest(ctx.request as Request);
	} catch (caught) {
		const message = formatIdentityFailure({
			hasToken: header.hasBearer,
			tokenBytes: header.headerBytes,
			sessionError: errorMessage(caught),
			metaError: null,
			id: null,
		});
		console.error("gpio-companion identity", {
			stage: "token",
			hasBearer: header.hasBearer,
			tokenBytes: header.headerBytes,
			error: message,
		});
		throw new Error(message);
	}
	if (!auth.getToken()) {
		throw new Error("sign in first");
	}
	const probe = await probeUserIdentity(auth);
	if (!probe.identity.id) {
		const message = formatIdentityFailure({
			hasToken: probe.hasToken || header.hasBearer,
			tokenBytes: probe.tokenBytes || header.headerBytes,
			sessionError: probe.sessionError,
			metaError: probe.metaError,
			id: probe.identity.id,
		});
		console.error("gpio-companion identity", {
			stage: "profile",
			hasBearer: header.hasBearer,
			tokenBytes: probe.tokenBytes || header.headerBytes,
			sessionError: probe.sessionError,
			metaError: probe.metaError,
			error: message,
		});
		throw new Error(message);
	}
	return probe.identity as SignedInIdentity;
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
