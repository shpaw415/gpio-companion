import type { ClientType, PublicSession } from "../../auth.ts";

export type UserIdentity = {
	id: string | null;
	email: string | null;
	name: string | null;
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

export async function resolveUserIdentity(
	auth: ClientType,
): Promise<UserIdentity> {
	const sessionResult = await auth.getUserSession("public").catch(() => null);
	const meta = await auth.getMetaData().catch(() => null);
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
	return {
		id:
			pickString(sessionPayload?.user_id, meta?.id, publicSession?.id) ?? null,
		email: pickString(
			publicSession?.email,
			jwtUserInfo?.email,
			metaData?.email,
			meta?.identifier,
		),
		name: pickString(publicSession?.name, jwtUserInfo?.name, metaData?.name),
	};
}

export function identityToPublicSession(identity: UserIdentity): PublicSession {
	return {
		id: identity.id ?? undefined,
		email: identity.email ?? undefined,
		name: identity.name ?? undefined,
	};
}
