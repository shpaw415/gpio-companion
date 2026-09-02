import { publicDeviceUrl, tunnelHostnames } from "gpio-companion";

export const T3_PATH = "/devices/t3";
export const T3_DEVICE_STORAGE_KEY = "gpio-companion-t3-device";
export const T3_FRAME_SLOT_ID = "gpio-t3-frame-slot";

export function isT3Path(pathname: string): boolean {
	return pathname === T3_PATH || pathname.startsWith(`${T3_PATH}/`);
}

export function t3AppUrl(uuid: string): string {
	const trimmed = uuid.trim();
	if (!trimmed) {
		return "";
	}
	return publicDeviceUrl(tunnelHostnames(trimmed).t3Hostname);
}

export function pickT3DeviceUuid(
	devices: Array<{ uuid: string }>,
	preferred = "",
): string {
	const want = preferred.trim();
	if (want && devices.some((device) => device.uuid === want)) {
		return want;
	}
	return devices[0]?.uuid ?? "";
}
