import {
	BLE_HEALTH_WIFI_SSID,
	classifyWifiConnectError,
	type WifiConfig,
	WifiConnectError,
	wifiDevicesToClaim,
} from "gpio-companion";
import { privileged } from "./priv.ts";

export type ApplyWifi = (config: WifiConfig) => Promise<{ ssid: string }>;

export type PrivilegedRun = (
	cmd: string[],
) => Promise<{ stdout: string; stderr: string; code: number }>;

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

async function claimUnmanagedWifi(run: PrivilegedRun): Promise<void> {
	await run(["rfkill", "unblock", "wifi"]);
	await run(["nmcli", "networking", "on"]);
	await run(["nmcli", "radio", "wifi", "on"]);
	const status = await run([
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
		await run(["nmcli", "device", "set", device, "managed", "yes"]);
	}
}

function activeWifiConnectionName(text: string, ssid: string): string {
	for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		const [name, type] = trimmed.split(":");
		if (name && (type === "802-11-wireless" || type === "wifi")) {
			return name;
		}
	}
	return ssid;
}

async function persistWifiConnection(
	run: PrivilegedRun,
	ssid: string,
): Promise<void> {
	const active = await run([
		"nmcli",
		"-t",
		"-f",
		"NAME,TYPE,DEVICE",
		"connection",
		"show",
		"--active",
	]);
	const name = activeWifiConnectionName(
		`${active.stdout}\n${active.stderr}`,
		ssid,
	);
	await run([
		"nmcli",
		"connection",
		"modify",
		name,
		"connection.autoconnect",
		"yes",
		"connection.autoconnect-retries",
		"-1",
		"802-11-wireless.powersave",
		"2",
	]);
}

export function applyNetworkManagerWifi(
	run: PrivilegedRun = runPrivileged,
): ApplyWifi {
	return async (config) => {
		if (config.ssid === BLE_HEALTH_WIFI_SSID) {
			throw new WifiConnectError("ssid-not-found");
		}
		await claimUnmanagedWifi(run);
		const { stdout, stderr, code } = await run([
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
		await persistWifiConnection(run, config.ssid);
		return { ssid: config.ssid };
	};
}
