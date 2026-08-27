export type PairingClaim = {
	uuid: string;
	key: string;
	userId: string;
	email: string;
	giteaLogin: string;
};

export type PairingPublic = {
	uuid: string;
	paired: boolean;
	giteaLogin: string;
};

export type PairingState = {
	uuid: string;
	key: string;
	claimed: boolean;
	userId: string;
	email: string;
	giteaLogin: string;
	claimedAt: string;
};

export function emptyPairingState(uuid = "", key = ""): PairingState {
	return {
		uuid,
		key,
		claimed: false,
		userId: "",
		email: "",
		giteaLogin: "",
		claimedAt: "",
	};
}

export function parsePairingClaim(input: unknown): PairingClaim {
	if (input === null || typeof input !== "object") {
		throw new Error("pairing claim must be an object");
	}
	const record = input as Record<string, unknown>;
	const uuid = requiredString(record.uuid, "uuid");
	const key = requiredString(record.key, "key");
	const userId = requiredString(record.userId, "userId");
	const email = optionalString(record.email);
	const giteaLogin =
		optionalString(record.giteaLogin) || giteaLoginFromEmail(email) || userId;
	return { uuid, key, userId, email, giteaLogin };
}

export function publicPairing(state: PairingState): PairingPublic {
	return {
		uuid: state.uuid,
		paired: state.claimed,
		giteaLogin: state.claimed ? state.giteaLogin : "",
	};
}

export function giteaLoginFromEmail(email: string): string {
	const at = email.indexOf("@");
	if (at <= 0) {
		return email;
	}
	return email.slice(0, at);
}

function requiredString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${field} is required`);
	}
	return value.trim();
}

function optionalString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}
