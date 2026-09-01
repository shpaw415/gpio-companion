import type { ClientType, PublicSession } from "../../auth.ts";
import { parseUserRole, type UserRole } from "./role.ts";

export type UserIdentity = {
	id: string | null;
	email: string | null;
	name: string | null;
	role: UserRole;
};

export type SignedInIdentity = UserIdentity & { id: string };

export type IdentityProbe = {
	identity: UserIdentity;
	hasToken: boolean;
	tokenBytes: number;
	sessionError: string | null;
	metaError: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}
	return null;
}

export function errorMessage(caught: unknown, depth = 0): string | null {
	if (depth > 3) {
		return null;
	}
	if (caught instanceof Error) {
		const parts = caught.message.trim() ? [caught.message.trim()] : [];
		if (caught.cause !== undefined) {
			const cause =
				errorMessage(caught.cause, depth + 1) ?? String(caught.cause);
			if (cause && cause !== parts[0]) {
				parts.push(cause);
			}
		}
		return parts.join(": ") || null;
	}
	if (typeof caught === "string" && caught.trim()) {
		return caught.trim();
	}
	if (
		caught &&
		typeof caught === "object" &&
		"message" in caught &&
		typeof (caught as { message: unknown }).message === "string"
	) {
		const message = (caught as { message: string }).message.trim();
		return message || null;
	}
	return null;
}

export function formatIdentityFailure(probe: {
	hasToken: boolean;
	tokenBytes: number;
	sessionError: string | null;
	metaError: string | null;
	id: string | null;
}): string {
	if (!probe.hasToken) {
		return "sign in first";
	}
	if (probe.id) {
		return "sign in first";
	}
	const parts = ["profile unavailable", `tokenBytes=${probe.tokenBytes}`];
	if (probe.sessionError) {
		parts.push(`session=${probe.sessionError}`);
	}
	if (probe.metaError) {
		parts.push(`meta=${probe.metaError}`);
	}
	if (!probe.sessionError && !probe.metaError) {
		parts.push("session and meta returned no user id");
	}
	return parts.join("; ");
}

export async function probeUserIdentity(
	auth: ClientType,
): Promise<IdentityProbe> {
	const token = auth.getToken();
	let sessionError: string | null = null;
	let metaError: string | null = null;
	let sessionResult: unknown = null;
	try {
		sessionResult = await auth.getUserSession("public");
	} catch (caught) {
		sessionError = errorMessage(caught);
	}
	if (sessionResult instanceof Error) {
		sessionError = sessionError ?? sessionResult.message;
		sessionResult = null;
	}
	let meta: Awaited<ReturnType<ClientType["getMetaData"]>> = null;
	try {
		meta = await auth.getMetaData();
	} catch (caught) {
		metaError = errorMessage(caught);
	}
	const sessionPayload =
		sessionResult && !(sessionResult instanceof Error)
			? asRecord(sessionResult)
			: null;
	const publicSession = asRecord(
		sessionPayload && "public" in sessionPayload
			? sessionPayload.public
			: sessionResult && !(sessionResult instanceof Error)
				? sessionResult
				: null,
	);
	const jwtUserInfo = asRecord(
		(auth as { userInfo?: unknown }).userInfo ?? meta?.data,
	);
	const metaData = asRecord(meta?.data);
	const sessionUserInfo = asRecord(sessionPayload?.userInfo);
	return {
		identity: {
			id:
				pickString(sessionPayload?.user_id, meta?.id, publicSession?.id) ??
				null,
			email: pickString(
				publicSession?.email,
				jwtUserInfo?.email,
				metaData?.email,
				meta?.identifier,
			),
			name: pickString(publicSession?.name, jwtUserInfo?.name, metaData?.name),
			role: parseUserRole(
				sessionUserInfo?.role,
				jwtUserInfo?.role,
				meta?.role,
				(auth as { userMeta?: { role?: unknown } }).userMeta?.role,
			),
		},
		hasToken: Boolean(token),
		tokenBytes: token?.length ?? 0,
		sessionError,
		metaError,
	};
}

export async function resolveUserIdentity(
	auth: ClientType,
): Promise<UserIdentity> {
	const probe = await probeUserIdentity(auth);
	return probe.identity;
}

export function identityToPublicSession(identity: UserIdentity): PublicSession {
	return {
		id: identity.id ?? undefined,
		email: identity.email ?? undefined,
		name: identity.name ?? undefined,
		role: identity.role,
	};
}
