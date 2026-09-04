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
	if (name.startsWith(BLE_DEVICE_NAME)) {
		return true;
	}
	const wanted = BLE_SERVICE_UUID.toLowerCase();
	return serviceUUIDs.some((id) => id.toLowerCase() === wanted);
}
