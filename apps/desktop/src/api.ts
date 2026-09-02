import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Device = {
	uuid: string;
	deviceUrl: string;
	login: string;
	label?: string;
};

export type DeviceList = {
	paired: boolean;
	devices: Device[];
};

export type Session = {
	id: string | null;
	email: string | null;
	name: string | null;
	role?: string | null;
};

export type NearbyBoard = {
	id: string;
	name: string;
	rssi: number | null;
	matched: boolean;
	pairingUuid?: string | null;
	hardware?: string | null;
};

export function nearbyBoardLabel(board: NearbyBoard) {
	if (board.matched) {
		const name = board.name.trim() || "gpio-companion";
		const extra = board.hardware?.trim() || board.pairingUuid?.slice(0, 8);
		return extra ? `${name} (${extra})` : name;
	}
	if (board.rssi != null) {
		return `Nearby ${board.rssi} dBm — ${board.id}`;
	}
	return board.id;
}

async function call<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	try {
		return await invoke<T>(cmd, args);
	} catch (caught) {
		throw new Error(typeof caught === "string" ? caught : "request failed");
	}
}

export function authToken() {
	return call<string | null>("auth_token");
}

export function authLogin() {
	return call<void>("auth_login");
}

export function authLogout() {
	return call<void>("auth_logout");
}

export function authSession() {
	return call<Session>("auth_session");
}

export function debugLogs() {
	return call<string[]>("debug_logs");
}

export function listDevices() {
	return call<DeviceList>("devices_list");
}

export function unpairDevice(uuid: string) {
	return call<unknown>("devices_unpair", { uuid });
}

export function bleScan() {
	return call<NearbyBoard[]>("ble_scan");
}

export function blePair(id: string) {
	return call<unknown>("ble_pair", { id });
}

export function bleWifi(input: {
	uuid: string;
	ssid: string;
	psk: string;
	id: string;
}) {
	return call<string>("ble_wifi", input);
}

export function onBleStatus(
	handler: (status: string) => void,
): Promise<UnlistenFn> {
	return listen<string>("ble-status", (event) => handler(event.payload));
}
