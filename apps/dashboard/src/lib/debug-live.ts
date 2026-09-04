import {
	DEBUG_LIVE_TTL_SEC,
	isLiveSeen,
	liveDeviceUrl,
	type MaintenanceReport,
	parseLivePingUuid,
} from "gpio-companion";
import type { PairingKv, PublicPairing } from "./pairing-store.ts";

export const LIVE_PREFIX = "live:";

export type LiveBoard = {
	uuid: string;
	deviceUrl: string;
	seenAt: number;
};

export type DebugBoard = {
	uuid: string;
	deviceUrl: string;
	label: string;
	email: string;
	login: string;
	userId: string;
	paired: boolean;
	live: boolean;
	seenAt: number | null;
	maintenance: MaintenanceReport | null;
};

export function liveKey(uuid: string): string {
	return `${LIVE_PREFIX}${uuid.trim()}`;
}

export function parseLiveBoard(raw: string | null): LiveBoard | null {
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as LiveBoard;
		if (
			typeof parsed.uuid !== "string" ||
			!parsed.uuid.trim() ||
			typeof parsed.deviceUrl !== "string" ||
			typeof parsed.seenAt !== "number"
		) {
			return null;
		}
		return {
			uuid: parsed.uuid.trim(),
			deviceUrl: parsed.deviceUrl,
			seenAt: parsed.seenAt,
		};
	} catch {
		return null;
	}
}

export async function putLiveBoard(
	kv: PairingKv,
	input: unknown,
	now = Date.now(),
): Promise<LiveBoard> {
	const uuid = parseLivePingUuid(input);
	const board: LiveBoard = {
		uuid,
		deviceUrl: liveDeviceUrl(uuid),
		seenAt: now,
	};
	await kv.put(liveKey(uuid), JSON.stringify(board), {
		expirationTtl: DEBUG_LIVE_TTL_SEC,
	});
	return board;
}

export async function getLiveBoard(
	kv: PairingKv,
	uuid: string,
	now = Date.now(),
): Promise<LiveBoard | null> {
	const board = parseLiveBoard(await kv.get(liveKey(uuid)));
	if (!board || !isLiveSeen(board.seenAt, now)) {
		return null;
	}
	return board;
}

export async function listLiveBoards(
	kv: PairingKv,
	now = Date.now(),
): Promise<LiveBoard[]> {
	if (!kv.list) {
		return [];
	}
	const boards: LiveBoard[] = [];
	let cursor: string | undefined;
	do {
		const page = await kv.list({ prefix: LIVE_PREFIX, cursor });
		for (const key of page.keys) {
			const board = parseLiveBoard(await kv.get(key.name));
			if (board && isLiveSeen(board.seenAt, now)) {
				boards.push(board);
			}
		}
		cursor = page.list_complete ? undefined : page.cursor;
	} while (cursor);
	return boards;
}

export function mergeDebugBoards(
	paired: PublicPairing[],
	live: LiveBoard[],
	includeUnpaired: boolean,
): DebugBoard[] {
	const liveByUuid = new Map(live.map((board) => [board.uuid, board]));
	const boards: DebugBoard[] = paired.map((device) => {
		const ping = liveByUuid.get(device.uuid);
		return {
			uuid: device.uuid,
			deviceUrl: device.deviceUrl || ping?.deviceUrl || "",
			label: device.label,
			email: device.email,
			login: device.login,
			userId: device.userId,
			paired: true,
			live: Boolean(ping),
			seenAt: ping?.seenAt ?? null,
			maintenance: null,
		};
	});
	if (includeUnpaired) {
		const pairedIds = new Set(paired.map((device) => device.uuid));
		for (const board of live) {
			if (pairedIds.has(board.uuid)) {
				continue;
			}
			boards.push({
				uuid: board.uuid,
				deviceUrl: board.deviceUrl,
				label: "",
				email: "",
				login: "",
				userId: "",
				paired: false,
				live: true,
				seenAt: board.seenAt,
				maintenance: null,
			});
		}
	}
	return boards;
}
