import {
	type DeviceConfig,
	emptyDeviceConfig,
	type HardwareId,
	parseDeviceConfig,
	type TunnelConfig,
} from "gpio-companion";

export const DEFAULT_CONFIG_PATH = "/etc/gpio-companion/config.json";
export const DEFAULT_TUNNEL_ENV_PATH = "/etc/gpio-companion/cloudflared.env";
export const DEFAULT_DEVICE_AUTH_PATH = "/etc/gpio-companion/device-auth.json";
export const DEFAULT_CLOCK_STAMP_PATH =
	"/etc/gpio-companion/last-device-timestamp";
export const DEFAULT_NONCE_PATH = "/etc/gpio-companion/device-nonces.json";
export const DEFAULT_PORT = 4150;

export type ConfigStore = {
	read(): Promise<DeviceConfig>;
	write(config: DeviceConfig): Promise<void>;
};

export function fileConfigStore(
	configPath: string,
	hardware: HardwareId = "raspberrypi",
): ConfigStore {
	return {
		async read() {
			const file = Bun.file(configPath);
			if (!(await file.exists())) {
				return emptyDeviceConfig(hardware);
			}
			return parseDeviceConfig(await file.json());
		},
		async write(config) {
			await Bun.write(configPath, `${JSON.stringify(config, null, "\t")}\n`);
		},
	};
}

export function tunnelEnvContents(tunnel: TunnelConfig): string {
	return [
		`TUNNEL_TOKEN=${systemdEnvValue(tunnel.token)}`,
		`TUNNEL_HOSTNAME=${systemdEnvValue(tunnel.hostname)}`,
		`TUNNEL_API_HOSTNAME=${systemdEnvValue(tunnel.apiHostname ?? "")}`,
		`TUNNEL_ID=${systemdEnvValue(tunnel.tunnelId ?? "")}`,
		"",
	].join("\n");
}

function systemdEnvValue(value: string): string {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
