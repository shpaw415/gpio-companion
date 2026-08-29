import type { WifiConfig } from "gpio-companion";

export type ApplyWifi = (config: WifiConfig) => Promise<{ ssid: string }>;

export function applyNetworkManagerWifi(): ApplyWifi {
	return async (config) => {
		const proc = Bun.spawn(
			[
				"nmcli",
				"device",
				"wifi",
				"connect",
				config.ssid,
				"password",
				config.psk,
			],
			{ stdout: "pipe", stderr: "pipe" },
		);
		const code = await proc.exited;
		if (code !== 0) {
			throw new Error("wifi connect failed");
		}
		return { ssid: config.ssid };
	};
}
