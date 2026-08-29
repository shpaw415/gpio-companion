import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	BLE_INFO_UUID,
	BLE_SERVICE_UUID,
	BLE_STATUS_UUID,
} from "gpio-companion";

export type BleBridgeOptions = {
	pairingUuid: string;
	hardware: string;
	port: number;
};

function bleScriptPath(): string | null {
	const fromEnv = process.env.GPIO_COMPANION_BLE_SCRIPT;
	if (fromEnv && existsSync(fromEnv)) {
		return fromEnv;
	}
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const candidates = [
			join(here, "../../../scripts/ble-gatt-server.py"),
			"/opt/gpio-companion/scripts/ble-gatt-server.py",
		];
		return candidates.find((path) => existsSync(path)) ?? null;
	} catch {
		return existsSync("/opt/gpio-companion/scripts/ble-gatt-server.py")
			? "/opt/gpio-companion/scripts/ble-gatt-server.py"
			: null;
	}
}

export function startBleBridge(options: BleBridgeOptions): void {
	if (process.env.GPIO_COMPANION_BLE === "0") {
		return;
	}
	const script = bleScriptPath();
	if (!script) {
		console.log("gpio-companion ble: script not found, skipping");
		return;
	}
	const child = Bun.spawn(["python3", script], {
		stdin: "ignore",
		stdout: "inherit",
		stderr: "inherit",
		env: {
			...process.env,
			GPIO_BLE_SERVICE: BLE_SERVICE_UUID,
			GPIO_BLE_INFO: BLE_INFO_UUID,
			GPIO_BLE_CMD: BLE_CMD_UUID,
			GPIO_BLE_STATUS: BLE_STATUS_UUID,
			GPIO_BLE_NAME: BLE_DEVICE_NAME,
			GPIO_COMPANION_BLE_API: `http://127.0.0.1:${options.port}`,
			GPIO_COMPANION_PAIRING_UUID: options.pairingUuid,
			GPIO_COMPANION_HARDWARE: options.hardware,
		},
	});
	void child.exited.then((code) => {
		if (code !== 0) {
			console.log(`gpio-companion ble: exited ${code}`);
		}
	});
	console.log("gpio-companion ble: advertising");
}
