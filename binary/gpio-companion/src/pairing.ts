import {
	emptyPairingState,
	type PairingClaim,
	type PairingState,
} from "gpio-companion";

export const DEFAULT_PAIRING_PATH = "/etc/gpio-companion/pairing.json";

export type PairingStore = {
	read(): Promise<PairingState>;
	write(state: PairingState): Promise<void>;
};

export function filePairingStore(
	path: string,
	uuid: string,
	key: string,
): PairingStore {
	return {
		async read() {
			const file = Bun.file(path);
			if (!(await file.exists())) {
				return emptyPairingState(uuid, key);
			}
			const parsed = (await file.json()) as PairingState;
			return {
				...emptyPairingState(uuid, key),
				...parsed,
				uuid: uuid || parsed.uuid,
				key: key || parsed.key,
			};
		},
		async write(state) {
			await Bun.write(path, `${JSON.stringify(state, null, "\t")}\n`);
		},
	};
}

export function pairingKeysMatch(expected: string, provided: string): boolean {
	const left = Buffer.from(expected);
	const right = Buffer.from(provided);
	if (left.length !== right.length || left.length === 0) {
		return false;
	}
	return crypto.timingSafeEqual(left, right);
}

export function applyClaim(
	state: PairingState,
	claim: PairingClaim,
): PairingState {
	if (!state.uuid || claim.uuid !== state.uuid) {
		throw new Error("pairing uuid mismatch");
	}
	if (!pairingKeysMatch(state.key, claim.key)) {
		throw new Error("pairing key mismatch");
	}
	if (state.claimed && state.userId !== claim.userId) {
		throw new Error("already paired");
	}
	return {
		...state,
		claimed: true,
		userId: claim.userId,
		email: claim.email,
		giteaLogin: claim.giteaLogin,
		claimedAt: new Date().toISOString(),
	};
}
