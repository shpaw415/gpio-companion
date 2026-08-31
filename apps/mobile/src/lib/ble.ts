import { BleManager, type Device, type Subscription } from "react-native-ble-plx";

export const BLE_SERVICE_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0001";
export const BLE_INFO_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0002";
export const BLE_CMD_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0003";
export const BLE_STATUS_UUID = "a1c15e00-6f10-4c9a-9c31-47b0c15e0004";
export const BLE_DEVICE_NAME = "gpio-companion";
export const BLE_CHUNK_SIZE = 160;

let manager: BleManager | null = null;

function getManager(): BleManager {
	if (!manager) {
		try {
			manager = new BleManager();
		} catch {
			throw new Error(
				"Bluetooth native module is missing. Use a dev build: npx expo run:android or npx expo run:ios (not Expo Go).",
			);
		}
	}
	return manager;
}

export type BleInfo = {
	uuid: string;
	hardware: string;
	name: string;
	deviceUrl?: string;
};

function encodeFrames(payload: string): string[] {
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

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export async function scanBoard(timeoutMs = 12_000): Promise<Device> {
	const ble = getManager();
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			ble.stopDeviceScan();
			reject(new Error("no gpio-companion board found"));
		}, timeoutMs);
		void ble.startDeviceScan(
			null,
			{ allowDuplicates: false },
			(error, device) => {
				if (error) {
					clearTimeout(timer);
					ble.stopDeviceScan();
					reject(error);
					return;
				}
				if (!device) {
					return;
				}
				const name = device.name ?? device.localName ?? "";
				const services = device.serviceUUIDs ?? [];
				if (
					name.startsWith(BLE_DEVICE_NAME) ||
					services.some(
						(id) => id.toLowerCase() === BLE_SERVICE_UUID.toLowerCase(),
					)
				) {
					clearTimeout(timer);
					ble.stopDeviceScan();
					resolve(device);
				}
			},
		);
	});
}

export async function readInfo(device: Device): Promise<BleInfo> {
	await device.connect();
	await device.discoverAllServicesAndCharacteristics();
	const info = await device.readCharacteristicForService(
		BLE_SERVICE_UUID,
		BLE_INFO_UUID,
	);
	if (!info.value) {
		throw new Error("invalid bluetooth info");
	}
	return JSON.parse(atob(info.value)) as BleInfo;
}

export async function sendEnvelope(
	device: Device,
	envelope: unknown,
): Promise<string> {
	const frames = encodeFrames(JSON.stringify(envelope));
	return new Promise((resolve, reject) => {
		let subscription: Subscription | undefined;
		const timer = setTimeout(() => {
			subscription?.remove();
			reject(new Error("bluetooth timed out"));
		}, 30_000);
		subscription = device.monitorCharacteristicForService(
			BLE_SERVICE_UUID,
			BLE_STATUS_UUID,
			(error, characteristic) => {
				if (error) {
					clearTimeout(timer);
					subscription?.remove();
					reject(error);
					return;
				}
				if (!characteristic?.value) {
					return;
				}
				clearTimeout(timer);
				subscription?.remove();
				resolve(atob(characteristic.value));
			},
		);
		void (async () => {
			try {
				for (const frame of frames) {
					await device.writeCharacteristicWithoutResponseForService(
						BLE_SERVICE_UUID,
						BLE_CMD_UUID,
						frame,
					);
				}
			} catch (caught) {
				clearTimeout(timer);
				subscription?.remove();
				reject(caught);
			}
		})();
	});
}
