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

export type JwtInspect = {
	parts: number;
	alg: string | null;
	kid: string | null;
	iss: string | null;
	aud: string | null;
	exp: number | null;
	mode: string | null;
	expired: boolean | null;
};

function decodeJwtPart(part: string): Record<string, unknown> | null {
	try {
		const padded = part.replace(/-/g, "+").replace(/_/g, "/");
		const pad = (4 - (padded.length % 4)) % 4;
		const json = atob(`${padded}${"=".repeat(pad)}`);
		const value = JSON.parse(json) as unknown;
		return asRecord(value);
	} catch {
		return null;
	}
}

export function inspectJwt(token: string): JwtInspect {
	const parts = token.split(".").filter((part) => part.length > 0);
	const header = parts[0] ? decodeJwtPart(parts[0]) : null;
	const payload = parts[1] ? decodeJwtPart(parts[1]) : null;
	const exp = typeof payload?.exp === "number" ? payload.exp : null;
	const audValue = payload?.aud;
	const aud = Array.isArray(audValue)
		? audValue.map(String).join(",")
		: pickString(audValue);
	return {
		parts: parts.length,
		alg: pickString(header?.alg),
		kid: pickString(header?.kid),
		iss: pickString(payload?.iss),
		aud,
		exp,
		mode: pickString(payload?.mode),
		expired: exp === null ? null : exp <= Math.floor(Date.now() / 1000),
	};
}

export function formatJwtInspect(jwt: JwtInspect): string {
	return [
		`parts=${jwt.parts}`,
		`alg=${jwt.alg ?? "?"}`,
		`kid=${jwt.kid ?? "?"}`,
		`iss=${jwt.iss ?? "?"}`,
		`aud=${jwt.aud ?? "?"}`,
		`exp=${jwt.exp ?? "?"}`,
		`mode=${jwt.mode ?? "?"}`,
		`expired=${jwt.expired ?? "?"}`,
	].join(" ");
}

export function formatIdentityFailure(probe: {
	hasToken: boolean;
	tokenBytes: number;
	sessionError: string | null;
	metaError: string | null;
	id: string | null;
	jwt?: string | null;
}): string {
	if (!probe.hasToken) {
		return "sign in first";
	}
	if (probe.id) {
		return "sign in first";
	}
	const parts = ["profile unavailable", `tokenBytes=${probe.tokenBytes}`];
	if (probe.jwt) {
		parts.push(`jwt=${probe.jwt}`);
	}
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
