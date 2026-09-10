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

export function fromBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

export function createBleAssembler(): {
	push(chunk: Uint8Array): string | null;
	reset(): void;
} {
	let buf = new Uint8Array(0);
	return {
		push(chunk: Uint8Array) {
			const next = new Uint8Array(buf.length + chunk.length);
			next.set(buf);
			next.set(chunk, buf.length);
			buf = next;
			if (buf.length === 0) {
				return null;
			}
			if (buf[0] === 0x7b) {
				try {
					const text = new TextDecoder().decode(buf).trim();
					JSON.parse(text);
					buf = new Uint8Array(0);
					return text;
				} catch {
					return null;
				}
			}
			if (buf.length < 4) {
				return null;
			}
			const length = new DataView(
				buf.buffer,
				buf.byteOffset,
				buf.byteLength,
			).getUint32(0);
			if (length > 256 * 1024) {
				buf = new Uint8Array(0);
				return null;
			}
			if (buf.length < 4 + length) {
				return null;
			}
			const text = new TextDecoder().decode(buf.slice(4, 4 + length));
			buf = buf.slice(4 + length);
			return text;
		},
		reset() {
			buf = new Uint8Array(0);
		},
	};
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

export function isBleIdleStatus(raw: string): boolean {
	const text = raw.trim();
	if (!text) {
		return true;
	}
	try {
		const parsed = JSON.parse(text) as {
			ready?: unknown;
			pending?: unknown;
		};
		if (
			parsed === null ||
			typeof parsed !== "object" ||
			Array.isArray(parsed)
		) {
			return false;
		}
		const keys = Object.keys(parsed);
		if (keys.length === 1 && parsed.ready === true) {
			return true;
		}
		return keys.length === 1 && parsed.pending === true;
	} catch {
		return false;
	}
}

export function isBleCompleteStatus(raw: string): boolean {
	const text = raw.trim();
	if (!text || isBleIdleStatus(text)) {
		return false;
	}
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

export function isBlePartialSnapshot(raw: string): boolean {
	const text = raw.trim();
	if (!text || isBleIdleStatus(text) || isBleCompleteStatus(text)) {
		return false;
	}
	return (
		(/"hardware"\s*:/.test(text) && /"pins"\s*:\s*\[/.test(text)) ||
		/"dashboardUrl"\s*:/.test(text) ||
		/"deviceAuth"\s*:/.test(text)
	);
}

export function isBleSettledStatus(raw: string): boolean {
	return isBleCompleteStatus(raw) || isBlePartialSnapshot(raw);
}

export function ingestBleStatus(
	assembler: ReturnType<typeof createBleAssembler>,
	chunk: Uint8Array,
): string | null {
	if (chunk.length === 0) {
		return null;
	}
	if (chunk[0] === 0x7b) {
		const text = new TextDecoder().decode(chunk).trim();
		if (isBleIdleStatus(text) || isBleCompleteStatus(text)) {
			assembler.reset();
			return text;
		}
		return null;
	}
	return assembler.push(chunk);
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
		return (
			left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
		);
	});
}

export function forPicker(boards: NearbyRadio[]): NearbyRadio[] {
	const matchedLive = boards.filter(
		(board) => board.matched && board.rssi != null,
	);
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
