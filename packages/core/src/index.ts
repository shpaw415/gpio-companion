export const PACKAGE_NAME = "gpio-companion";
export const VERSION = "0.0.0";

export function greet(from = PACKAGE_NAME): string {
	return `hello from ${from}`;
}

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
	parseDeviceSecrets,
	secretsStatus,
} from "./secrets.ts";
