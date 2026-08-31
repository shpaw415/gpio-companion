import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	BLE_INFO_UUID,
	BLE_SERVICE_UUID,
	BLE_STATUS_UUID,
	type BleInfo,
	type SignedDeviceEnvelope,
	splitBleFrames,
} from "gpio-companion";

type GattCharacteristic = {
	readValue(): Promise<DataView>;
	writeValueWithoutResponse?(value: BufferSource): Promise<void>;
	writeValue?(value: BufferSource): Promise<void>;
	startNotifications(): Promise<unknown>;
	addEventListener(
		type: "characteristicvaluechanged",
		listener: (event: Event) => void,
	): void;
};

type BluetoothNav = Navigator & {
	bluetooth?: {
		getAvailability?(): Promise<boolean>;
		requestDevice(options: {
			filters: Array<{ namePrefix?: string; services?: string[] }>;
			optionalServices?: string[];
		}): Promise<{
			gatt?: {
				connect(): Promise<{
					getPrimaryService(uuid: string): Promise<{
						getCharacteristic(uuid: string): Promise<GattCharacteristic>;
					}>;
				}>;
				disconnect(): void;
			};
		}>;
	};
};

export function bluetoothSupported(): boolean {
	return Boolean((navigator as BluetoothNav).bluetooth);
}

export async function bluetoothAvailable(): Promise<boolean> {
	const bluetooth = (navigator as BluetoothNav).bluetooth;
	if (!bluetooth) {
		return false;
	}
	if (typeof bluetooth.getAvailability === "function") {
		try {
			return await bluetooth.getAvailability();
		} catch {
			return true;
		}
	}
	return true;
}

export function bluetoothChooserCancelled(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}
	const name = "name" in error ? String(error.name) : "";
	return name === "NotFoundError" || name === "AbortError";
}

function decodeView(view: DataView): string {
	return new TextDecoder().decode(
		new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
	);
}

export async function connectGpioCompanionBle(): Promise<{
	info: BleInfo;
	sendEnvelope: (envelope: SignedDeviceEnvelope) => Promise<string>;
	disconnect: () => void;
}> {
	const bluetooth = (navigator as BluetoothNav).bluetooth;
	if (!bluetooth) {
		throw new Error("Web Bluetooth is not available in this browser");
	}
	const device = await bluetooth.requestDevice({
		filters: [{ namePrefix: BLE_DEVICE_NAME }],
		optionalServices: [BLE_SERVICE_UUID],
	});
	const gatt = device.gatt;
	if (!gatt) {
		throw new Error("bluetooth GATT is unavailable");
	}
	const server = await gatt.connect();
	const service = await server.getPrimaryService(BLE_SERVICE_UUID);
	const infoChar = await service.getCharacteristic(BLE_INFO_UUID);
	const cmdChar = await service.getCharacteristic(BLE_CMD_UUID);
	const statusChar = await service.getCharacteristic(BLE_STATUS_UUID);
	let info: BleInfo;
	try {
		info = JSON.parse(decodeView(await infoChar.readValue())) as BleInfo;
	} catch {
		throw new Error("invalid bluetooth info");
	}

	async function sendEnvelope(envelope: SignedDeviceEnvelope): Promise<string> {
		const frames = splitBleFrames(JSON.stringify(envelope));
		return new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error("bluetooth timed out"));
			}, 30_000);
			statusChar.addEventListener("characteristicvaluechanged", (event) => {
				const target = event.target as { value?: DataView };
				if (!target.value) {
					return;
				}
				clearTimeout(timer);
				resolve(decodeView(target.value));
			});
			void statusChar.startNotifications().then(async () => {
				for (const frame of frames) {
					const bytes = new Uint8Array(frame) as Uint8Array<ArrayBuffer>;
					if (cmdChar.writeValueWithoutResponse) {
						await cmdChar.writeValueWithoutResponse(bytes);
					} else if (cmdChar.writeValue) {
						await cmdChar.writeValue(bytes);
					} else {
						throw new Error("bluetooth write is unavailable");
					}
				}
			}, reject);
		});
	}

	return {
		info,
		sendEnvelope,
		disconnect: () => {
			gatt.disconnect();
		},
	};
}
