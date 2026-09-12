import {
	classifyWifiConnectError,
	type WifiConfig,
	WifiConnectError,
	wifiDevicesToClaim,
} from "gpio-companion";
import { privileged } from "./priv.ts";

export type ApplyWifi = (config: WifiConfig) => Promise<{ ssid: string }>;

async function readPipe(
	stream: ReadableStream<Uint8Array> | number | undefined,
): Promise<string> {
	if (!stream || typeof stream === "number") {
		return "";
	}
	return new Response(stream).text();
}

async function runPrivileged(
	cmd: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
	const proc = Bun.spawn(privileged(cmd), { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		readPipe(proc.stdout),
		readPipe(proc.stderr),
		proc.exited,
	]);
	return { stdout, stderr, code };
}

async function claimUnmanagedWifi(): Promise<void> {
	await runPrivileged(["rfkill", "unblock", "wifi"]);
	await runPrivileged(["nmcli", "networking", "on"]);
	await runPrivileged(["nmcli", "radio", "wifi", "on"]);
	const status = await runPrivileged([
		"nmcli",
		"-t",
		"-f",
		"DEVICE,TYPE,STATE",
		"device",
		"status",
	]);
	for (const device of wifiDevicesToClaim(
		`${status.stdout}\n${status.stderr}`,
	)) {
		await runPrivileged(["nmcli", "device", "set", device, "managed", "yes"]);
		await runPrivileged(["ip", "link", "set", device, "down"]);
		await runPrivileged(["ip", "link", "set", device, "up"]);
	}
}

export function applyNetworkManagerWifi(): ApplyWifi {
	return async (config) => {
		await claimUnmanagedWifi();
		const { stdout, stderr, code } = await runPrivileged([
			"nmcli",
			"device",
			"wifi",
			"connect",
			config.ssid,
			"password",
			config.psk,
		]);
		if (code !== 0) {
			throw new WifiConnectError(
				classifyWifiConnectError(`${stdout}\n${stderr}`),
			);
		}
		return { ssid: config.ssid };
	};
}
