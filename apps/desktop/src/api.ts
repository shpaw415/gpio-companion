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

export function listDevices() {
	return call<DeviceList>("devices_list");
}

export function unpairDevice(uuid: string) {
	return call<unknown>("devices_unpair", { uuid });
}

export function blePair() {
	return call<unknown>("ble_pair");
}

export function bleWifi(input: { uuid: string; ssid: string; psk: string }) {
	return call<string>("ble_wifi", input);
}

export function onBleStatus(
	handler: (status: string) => void,
): Promise<UnlistenFn> {
	return listen<string>("ble-status", (event) => handler(event.payload));
}
