import type { DeviceConfig } from "gpio-companion";
import { DEFAULT_TUNNEL_ENV_PATH, tunnelEnvContents } from "./store.ts";

export type ApplyTunnel = (config: DeviceConfig) => Promise<void>;

export function applyCloudflaredReplica(
	envPath = DEFAULT_TUNNEL_ENV_PATH,
): ApplyTunnel {
	return async (config) => {
		await Bun.write(envPath, tunnelEnvContents(config.tunnel));
		if (!config.tunnel.token) {
			await spawnSystemctl(["disable", "--now", "cloudflared-gpio.service"]);
			return;
		}
		await spawnSystemctl(["enable", "--now", "cloudflared-gpio.service"]);
		await spawnSystemctl(["restart", "cloudflared-gpio.service"]);
	};
}

async function spawnSystemctl(args: string[]): Promise<void> {
	if (!process.env.GPIO_COMPANION_SYSTEMCTL) {
		const which = Bun.which("systemctl");
		if (!which) {
			return;
		}
	}
	const systemctl = process.env.GPIO_COMPANION_SYSTEMCTL ?? "systemctl";
	const result = await Bun.spawn([systemctl, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	}).exited;
	if (result !== 0) {
		throw new Error(`systemctl ${args.join(" ")} failed (${result})`);
	}
}
