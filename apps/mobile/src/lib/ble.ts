import { PermissionsAndroid, Platform } from "react-native";
import {
	BleManager,
	State,
	type Device,
	type Subscription,
} from "react-native-ble-plx";

import {
	BLE_CMD_UUID,
	BLE_INFO_UUID,
	BLE_SERVICE_UUID,
	BLE_STATUS_UUID,
	encodeFrames,
	forPicker,
	looksLikeMac,
	matchesBoard,
	type BleInfo,
	type NearbyRadio,
} from "./ble-frame.ts";
import {
	BLE_PERMISSION_DENIED,
	androidBlePermissions,
	mapBleUnauthorized,
} from "./ble-permissions.ts";

export {
	BLE_CHUNK_SIZE,
	BLE_DEVICE_NAME,
	BLE_SERVICE_UUID,
	encodeFrames,
	matchesBoard,
	nearbyBoardLabel,
} from "./ble-frame.ts";
export type { BleInfo, NearbyRadio } from "./ble-frame.ts";

const CONNECT_TIMEOUT_MS = 15_000;
const OP_TIMEOUT_MS = 15_000;
const RESPONSE_TIMEOUT_MS = 30_000;
const FRAME_GAP_MS = 20;
const BLUETOOTH_WAIT_MS = 5_000;

let manager: BleManager | null = null;
const scannedDevices = new Map<string, Device>();

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

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`${message} (timed out)`));
		}, ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(caught) => {
				clearTimeout(timer);
				reject(caught instanceof Error ? caught : new Error(String(caught)));
			},
		);
	});
}

async function requestAndroidBlePermissions(): Promise<void> {
	if (Platform.OS !== "android") {
		return;
	}
	const api =
		typeof Platform.Version === "number"
			? Platform.Version
			: Number.parseInt(String(Platform.Version), 10);
	const permissions = androidBlePermissions(Number.isFinite(api) ? api : 31);
	const result = await PermissionsAndroid.requestMultiple(permissions);
	const denied = permissions.filter(
		(permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED,
	);
	if (denied.length > 0) {
		throw new Error(BLE_PERMISSION_DENIED);
	}
}

function bluetoothStateLabel(state: State): string {
	if (state === State.Unauthorized) {
		return BLE_PERMISSION_DENIED;
	}
	if (state === State.PoweredOff) {
		return "Bluetooth is off — turn it on and try again";
	}
	return `Bluetooth is unavailable (${state}) — try again`;
}

export async function ensureBluetoothOn(): Promise<void> {
	await requestAndroidBlePermissions();
	const ble = getManager();
	const state = await ble.state();
	if (state === State.PoweredOn) {
		return;
	}
	if (state === State.Unauthorized) {
		throw new Error(BLE_PERMISSION_DENIED);
	}
	const label = bluetoothStateLabel(state);
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(() => {
			subscription.remove();
			reject(new Error(label));
		}, BLUETOOTH_WAIT_MS);
		const subscription = ble.onStateChange((next) => {
			if (next === State.PoweredOn) {
				clearTimeout(timer);
				subscription.remove();
				resolve();
			}
			if (next === State.Unauthorized) {
				clearTimeout(timer);
				subscription.remove();
				reject(new Error(BLE_PERMISSION_DENIED));
			}
		}, true);
	});
}

export function scannedDevice(id: string): Device | undefined {
	return scannedDevices.get(id);
}

export async function scanNearby(timeoutMs = 20_000): Promise<NearbyRadio[]> {
	const ble = getManager();
	scannedDevices.clear();
	const radios = new Map<string, NearbyRadio>();
	return new Promise<NearbyRadio[]>((resolve, reject) => {
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (settle: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timer) {
				clearTimeout(timer);
			}
			ble.stopDeviceScan();
			settle();
		};
		timer = setTimeout(
			() => finish(() => resolve(forPicker([...radios.values()]))),
			timeoutMs,
		);
		void ble.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
			if (error) {
				finish(() => reject(new Error(mapBleUnauthorized(error.message))));
				return;
			}
			if (!device) {
				return;
			}
			scannedDevices.set(device.id, device);
			const name = device.name ?? device.localName ?? "";
			const previous = radios.get(device.id);
			const matched =
				matchesBoard(name, device.serviceUUIDs ?? []) || Boolean(previous?.matched);
			const betterName =
				name && !looksLikeMac(name) ? name : (previous?.name ?? name);
			radios.set(device.id, {
				id: device.id,
				name: betterName,
				rssi: device.rssi ?? previous?.rssi ?? null,
				matched,
			});
		});
	});
}

export async function scanBoard(timeoutMs = 20_000): Promise<Device> {
	const nearby = await scanNearby(timeoutMs);
	const pick = nearby.find((board) => board.matched) ?? nearby[0];
	const device = pick ? scannedDevices.get(pick.id) : undefined;
	if (!device) {
		throw new Error("no gpio-companion board found nearby");
	}
	return device;
}

export type BoardSession = {
	device: Device;
	close: () => Promise<void>;
};

export async function openBoardSession(
	device: Device,
	onLost?: (reason: string) => void,
	timeoutMs = CONNECT_TIMEOUT_MS,
): Promise<BoardSession> {
	try {
		await withTimeout(
			device.connect({ autoConnect: false }),
			timeoutMs,
			"board did not accept the bluetooth connection",
		);
	} catch (caught) {
		void device.cancelConnection().catch(() => undefined);
		throw caught;
	}
	const subscription = device.onDisconnected((error) => {
		onLost?.(
			error
				? `board disconnected (${error.message})`
				: "board disconnected — try again",
		);
	});
	let closed = false;
	return {
		device,
		close: async () => {
			if (closed) {
				return;
			}
			closed = true;
			subscription.remove();
			try {
				await device.cancelConnection();
			} catch {
				// the board may already be gone
			}
		},
	};
}

export async function readInfo(device: Device): Promise<BleInfo> {
	await withTimeout(
		device.discoverAllServicesAndCharacteristics(),
		OP_TIMEOUT_MS,
		"board did not expose its bluetooth services",
	);
	const info = await withTimeout(
		device.readCharacteristicForService(BLE_SERVICE_UUID, BLE_INFO_UUID),
		OP_TIMEOUT_MS,
		"board did not share its info",
	);
	if (!info.value) {
		throw new Error("invalid bluetooth info");
	}
	return JSON.parse(atob(info.value)) as BleInfo;
}

export type BoardLoss = {
	signal: AbortSignal;
	reason: () => string;
	lose: (why?: string) => void;
};

export function createBoardLoss(): BoardLoss {
	const controller = new AbortController();
	let why = "board disconnected — try again";
	return {
		signal: controller.signal,
		reason: () => why,
		lose: (reason?: string) => {
			if (controller.signal.aborted) {
				return;
			}
			if (reason && reason.length > 0) {
				why = reason;
			}
			controller.abort();
		},
	};
}

export async function sendEnvelope(
	device: Device,
	envelope: unknown,
	loss?: BoardLoss,
): Promise<string> {
	const frames = encodeFrames(JSON.stringify(envelope));
	return new Promise<string>((resolve, reject) => {
		let subscription: Subscription | undefined;
		let settled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const finish = (settle: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timer) {
				clearTimeout(timer);
			}
			loss?.signal.removeEventListener("abort", onAbort);
			subscription?.remove();
			settle();
		};
		const onAbort = () => {
			finish(() => reject(new Error(loss ? loss.reason() : "board disconnected")));
		};
		timer = setTimeout(
			() =>
				finish(() =>
					reject(new Error("board did not respond over bluetooth (timed out)")),
				),
			RESPONSE_TIMEOUT_MS,
		);
		loss?.signal.addEventListener("abort", onAbort);
		subscription = device.monitorCharacteristicForService(
			BLE_SERVICE_UUID,
			BLE_STATUS_UUID,
			(error, characteristic) => {
				if (error) {
					finish(() =>
						reject(new Error(mapBleUnauthorized(error.message))),
					);
					return;
				}
				if (!characteristic?.value) {
					return;
				}
				const value = characteristic.value;
				finish(() => resolve(atob(value)));
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
					await sleep(FRAME_GAP_MS);
				}
			} catch (caught) {
				finish(() =>
					reject(
						caught instanceof Error ? caught : new Error("bluetooth write failed"),
					),
				);
			}
		})();
	});
}
