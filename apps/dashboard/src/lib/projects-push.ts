import { PROJECTS_SYNC_PATH } from "gpio-companion";
import { getLiveBoard } from "./debug-live.ts";
import {
	type DeviceSigningEnv,
	type FetchLike,
	signedDeviceFetch,
} from "./device-api.ts";
import { loadDevices, type PairingKv } from "./pairing-store.ts";

export const PROJECT_PUSH_TIMEOUT_MS = 4_000;

export type ProjectPushEnv = DeviceSigningEnv & {
	DYNAMIC_PAGE_KV: PairingKv;
};

export type ProjectPushRepo = {
	owner: string;
	name: string;
};

export async function pushProjectToLiveBoards(
	env: ProjectPushEnv,
	userId: string,
	repo: ProjectPushRepo,
	options?: {
		now?: number;
		timeoutMs?: number;
		fetchImpl?: FetchLike;
	},
): Promise<void> {
	const devices = await loadDevices(env.DYNAMIC_PAGE_KV, userId);
	await Promise.all(
		devices.map(async (device) => {
			const live = await getLiveBoard(
				env.DYNAMIC_PAGE_KV,
				device.uuid,
				options?.now,
			);
			if (!live) {
				return;
			}
			const deviceUrl = device.deviceUrl || live.deviceUrl;
			if (!deviceUrl) {
				return;
			}
			try {
				await signedDeviceFetch(
					env,
					deviceUrl,
					"POST",
					PROJECTS_SYNC_PATH,
					{ owner: repo.owner, name: repo.name },
					{
						timeoutMs: options?.timeoutMs ?? PROJECT_PUSH_TIMEOUT_MS,
						fetchImpl: options?.fetchImpl,
					},
				);
			} catch {
				undefined;
			}
		}),
	);
}
