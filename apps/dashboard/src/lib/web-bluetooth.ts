import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	BLE_INFO_UUID,
	BLE_SERVICE_UUID,
	BLE_STATUS_UUID,
	type BleInfo,
	isBleIdleStatus,
	isBleSettledStatus,
	type SignedDeviceEnvelope,
	splitBleFrames,
} from "gpio-companion";
import { loadWebBleId } from "./ble-devices.ts";
import { rememberPairedBle } from "./ble-link.ts";

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

type BluetoothDevice = {
	id: string;
	gatt?: {
		connect(): Promise<{
			getPrimaryService(uuid: string): Promise<{
				getCharacteristic(uuid: string): Promise<GattCharacteristic>;
			}>;
		}>;
		disconnect(): void;
	};
};

type BluetoothNav = Navigator & {
	bluetooth?: {
		getAvailability?(): Promise<boolean>;
		getDevices?(): Promise<BluetoothDevice[]>;
		requestDevice(options: {
			filters: Array<{ namePrefix?: string; services?: string[] }>;
			optionalServices?: string[];
		}): Promise<BluetoothDevice>;
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

async function requestCompanionDevice(
	bluetooth: NonNullable<BluetoothNav["bluetooth"]>,
): Promise<BluetoothDevice> {
	return bluetooth.requestDevice({
		filters: [
			{ services: [BLE_SERVICE_UUID] },
			{ namePrefix: BLE_DEVICE_NAME },
		],
		optionalServices: [BLE_SERVICE_UUID],
	});
}

async function rememberedCompanionDevice(
	bluetooth: NonNullable<BluetoothNav["bluetooth"]>,
	uuid: string,
): Promise<BluetoothDevice | null> {
	if (!uuid || typeof bluetooth.getDevices !== "function") {
		return null;
	}
	const remembered = await loadWebBleId(uuid);
	if (!remembered) {
		return null;
	}
	try {
		const devices = await bluetooth.getDevices();
		return devices.find((device) => device.id === remembered) ?? null;
	} catch {
		return null;
	}
}

export async function connectGpioCompanionBle(uuid = ""): Promise<{
	info: BleInfo;
	sendEnvelope: (envelope: SignedDeviceEnvelope) => Promise<string>;
	disconnect: () => void;
}> {
	const bluetooth = (navigator as BluetoothNav).bluetooth;
	if (!bluetooth) {
		throw new Error("Web Bluetooth is not available in this browser");
	}
	const trimmed = uuid.trim();
	const remembered = await rememberedCompanionDevice(bluetooth, trimmed);
	let device = remembered;
	if (!device) {
		device = await requestCompanionDevice(bluetooth);
	}
	try {
		return await openCompanionSession(device, trimmed);
	} catch (caught) {
		if (!remembered) {
			throw caught;
		}
		device = await requestCompanionDevice(bluetooth);
		return openCompanionSession(device, trimmed);
	}
}

async function openCompanionSession(
	device: BluetoothDevice,
	uuid: string,
): Promise<{
	info: BleInfo;
	sendEnvelope: (envelope: SignedDeviceEnvelope) => Promise<string>;
	disconnect: () => void;
}> {
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
	if (uuid && info.uuid && info.uuid !== uuid) {
		gatt.disconnect();
		throw new Error("this board is not the selected paired device");
	}
	const linked = uuid || info.uuid?.trim() || "";
	if (linked && (!info.uuid || info.uuid === linked)) {
		void rememberPairedBle(linked, device.id);
	}

	async function sendEnvelope(envelope: SignedDeviceEnvelope): Promise<string> {
		const frames = splitBleFrames(JSON.stringify(envelope));
		let previous = "";
		let lastUseful = "";
		try {
			previous = decodeView(await statusChar.readValue());
		} catch {
			previous = "";
		}
		return new Promise<string>((resolve, reject) => {
			let settled = false;
			let armed = false;
			let poll: ReturnType<typeof setInterval> | undefined;
			const finish = (text: string) => {
				if (isBleIdleStatus(text)) {
					previous = "";
					return;
				}
				if (isBleSettledStatus(text)) {
					lastUseful = text;
				}
				if (!armed || settled) {
					return;
				}
				if (!isBleSettledStatus(text) || text === previous) {
					return;
				}
				settled = true;
				clearTimeout(timer);
				if (poll) {
					clearInterval(poll);
				}
				resolve(text);
			};
			const timer = setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				if (poll) {
					clearInterval(poll);
				}
				if (isBleSettledStatus(lastUseful)) {
					resolve(lastUseful);
					return;
				}
				reject(
					new Error(
						"bluetooth timed out waiting for the status characteristic. Update the Pi companion BLE helper if this persists.",
					),
				);
			}, 30_000);
			statusChar.addEventListener("characteristicvaluechanged", (event) => {
				const target = event.target as { value?: DataView };
				if (!target.value) {
					return;
				}
				finish(decodeView(target.value));
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
				armed = true;
				poll = setInterval(() => {
					void statusChar.readValue().then(
						(view) => {
							finish(decodeView(view));
						},
						() => undefined,
					);
				}, 500);
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
