export const BLE_SERVICE_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0001";
export const BLE_INFO_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0002";
export const BLE_CMD_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0003";
export const BLE_STATUS_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0004";
export const BLE_DEVICE_NAME = "gpio-companion";
export const BLE_CHUNK_SIZE = 160;

export type BleInfo = {
	uuid: string;
	hardware: string;
	name: string;
	deviceUrl?: string;
};

export function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export function encodeFrames(payload: string): string[] {
	const body = new TextEncoder().encode(payload);
	const all = new Uint8Array(4 + body.length);
	new DataView(all.buffer).setUint32(0, body.length);
	all.set(body, 4);
	const frames: string[] = [];
	for (let offset = 0; offset < all.length; offset += BLE_CHUNK_SIZE) {
		frames.push(toBase64(all.slice(offset, offset + BLE_CHUNK_SIZE)));
	}
	return frames;
}

export function matchesBoard(name: string, serviceUUIDs: string[]): boolean {
	const lower = name.toLowerCase();
	if (lower.startsWith(BLE_DEVICE_NAME) || lower === "gpio") {
		return true;
	}
	const wanted = BLE_SERVICE_UUID.toLowerCase();
	return serviceUUIDs.some((id) => id.toLowerCase() === wanted);
}

export type NearbyRadio = {
	id: string;
	name: string;
	rssi: number | null;
	matched: boolean;
};

export function looksLikeMac(value: string): boolean {
	const hex = value.replace(/[^0-9a-fA-F]/g, "");
	if (hex.length !== 12) {
		return false;
	}
	return [...value].every((ch) => /[0-9a-fA-F:\-_]/.test(ch));
}

function rssiSuffix(rssi: number | null): string {
	return rssi != null ? ` (${rssi} dBm)` : "";
}

export function nearbyBoardLabel(board: NearbyRadio): string {
	const name = board.name.trim();
	const named = Boolean(name) && !looksLikeMac(name);
	if (board.matched) {
		return named ? name : BLE_DEVICE_NAME;
	}
	if (named) {
		return `${name}${rssiSuffix(board.rssi)}`;
	}
	return `Nearby radio${rssiSuffix(board.rssi)}`;
}

export function sortNearby(boards: NearbyRadio[]): NearbyRadio[] {
	return [...boards].sort((left, right) => {
		if (left.matched !== right.matched) {
			return left.matched ? -1 : 1;
		}
		const leftRssi = left.rssi ?? Number.NEGATIVE_INFINITY;
		const rightRssi = right.rssi ?? Number.NEGATIVE_INFINITY;
		if (leftRssi !== rightRssi) {
			return rightRssi - leftRssi;
		}
		return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
	});
}

export function forPicker(boards: NearbyRadio[]): NearbyRadio[] {
	const matchedLive = boards.filter((board) => board.matched && board.rssi != null);
	if (matchedLive.length > 0) {
		return sortNearby(matchedLive);
	}
	const matched = boards.filter((board) => board.matched);
	const live = boards.filter((board) => board.rssi != null);
	if (matched.length > 0) {
		if (live.length === 0) {
			return sortNearby(matched);
		}
		const out = [...matched];
		for (const board of live) {
			if (!out.some((existing) => existing.id === board.id)) {
				out.push(board);
			}
		}
		return sortNearby(out);
	}
	return sortNearby(live.length > 0 ? live : boards);
}
