export const PACKAGE_NAME = "gpio-companion";
export const VERSION = "0.0.0";

export function greet(from = PACKAGE_NAME): string {
	return `hello from ${from}`;
}

export {
	BLE_CHUNK_SIZE,
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	BLE_INFO_UUID,
	BLE_SERVICE_UUID,
	BLE_STATUS_UUID,
	type BleInfo,
	createBleAssembler,
	createSignedEnvelope,
	envelopeToPasteText,
	envelopeToRequest,
	parseSignedEnvelope,
	type SignedDeviceEnvelope,
	splitBleFrames,
} from "./ble.ts";
export {
	type DeviceConfig,
	emptyDeviceConfig,
	HARDWARE_IDS,
	type HardwareId,
	isHardwareId,
	parseDeviceConfig,
	parseTunnelConfig,
	redactDeviceConfig,
	type TunnelConfig,
} from "./config.ts";
export {
	canonicalDevicePayload,
	DEFAULT_DEVICE_MAX_SKEW_MS,
	DEVICE_AUTH_HEADERS,
	DEVICE_AUTH_VERSION,
	DeviceAuthError,
	type DeviceAuthHeaders,
	type DeviceKeyPair,
	devicePublicKeySource,
	generateDeviceKeyPair,
	normalizeDevicePath,
	signDeviceRequest,
	verifyDeviceRequest,
} from "./device-auth.ts";
export {
	DEFAULT_DEVICE_KEY_ID,
	DEFAULT_DEVICE_PUBLIC_KEY_PEM,
} from "./device-public-key.ts";
export {
	emptyPairingState,
	giteaLoginFromEmail,
	type PairingClaim,
	type PairingCredentials,
	type PairingPublic,
	type PairingState,
	pairingCredentials,
	parsePairingClaim,
	parsePairingUnpair,
	publicPairing,
} from "./pairing.ts";
export {
	BREADBOARD_CIRCUIT_JSON,
	BREADBOARD_PREVIEW_SVG,
	isProjectFileDir,
	PCB_CIRCUIT_JSON,
	PCB_PREVIEW_SVG,
	PROJECT_FILE_DIRS,
	type ProjectFileDir,
} from "./project-files.ts";
export {
	type DeviceSecrets,
	emptyDeviceSecrets,
	mergeDeviceSecrets,
	parseDeviceSecrets,
	secretsStatus,
} from "./secrets.ts";
export {
	parseWifiConfig,
	publicWifiStatus,
	type WifiConfig,
} from "./wifi.ts";
