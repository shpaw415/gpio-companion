import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	BLE_CMD_UUID,
	BLE_DEVICE_NAME,
	BLE_INFO_UUID,
	BLE_SERVICE_UUID,
	BLE_STATUS_UUID,
} from "gpio-companion";

export const INSTALLED_BLE_SCRIPT =
	"/usr/local/lib/gpio-companion/ble-gatt-server.py";
export const FALLBACK_BLE_SCRIPT =
	"/opt/gpio-companion/scripts/ble-gatt-server.py";

export type BleBridgeOptions = {
	pairingUuid: string;
	hardware: string;
	port: number;
	deviceUrl?: string;
};

export type BleScriptLookup = {
	env?: NodeJS.Dict<string>;
	exists?: (path: string) => boolean;
	readRepoPath?: () => string | null;
	sourceDir?: string | null;
};

export function bleScriptCandidates(lookup: BleScriptLookup = {}): string[] {
	const env = lookup.env ?? process.env;
	const candidates: string[] = [];
	const fromEnv = env.GPIO_COMPANION_BLE_SCRIPT?.trim();
	if (fromEnv) {
		candidates.push(fromEnv);
	}
	candidates.push(installedBleScript(env));
	const repo = lookup.readRepoPath
		? lookup.readRepoPath()
		: defaultRepoPath(env);
	if (repo) {
		candidates.push(join(repo, "scripts/ble-gatt-server.py"));
	}
	candidates.push(FALLBACK_BLE_SCRIPT);
	const here =
		lookup.sourceDir === undefined ? defaultSourceDir() : lookup.sourceDir;
	if (here) {
		candidates.push(join(here, "../../../scripts/ble-gatt-server.py"));
	}
	return candidates;
}

export function resolveBleScriptPath(
	lookup: BleScriptLookup = {},
): string | null {
	const exists = lookup.exists ?? existsSync;
	return bleScriptCandidates(lookup).find((path) => exists(path)) ?? null;
}

export function startBleBridge(options: BleBridgeOptions): void {
	if (process.env.GPIO_COMPANION_BLE === "0") {
		return;
	}
	const script = resolveBleScriptPath();
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
			GPIO_COMPANION_DEVICE_URL: options.deviceUrl ?? "",
		},
	});
	void child.exited.then((code) => {
		if (code !== 0) {
			console.log(`gpio-companion ble: exited ${code}`);
		}
	});
	console.log("gpio-companion ble: advertising");
}

function installedBleScript(env: NodeJS.Dict<string>): string {
	const libDir = env.GPIO_COMPANION_LIB_DIR?.trim();
	if (libDir) {
		return join(libDir, "ble-gatt-server.py");
	}
	return INSTALLED_BLE_SCRIPT;
}

function defaultRepoPath(env: NodeJS.Dict<string>): string | null {
	const configDir =
		env.GPIO_COMPANION_CONFIG_DIR?.trim() || "/etc/gpio-companion";
	try {
		const repo = readFileSync(join(configDir, "repo.path"), "utf8").trim();
		return repo.length > 0 ? repo : null;
	} catch {
		return null;
	}
}

function defaultSourceDir(): string | null {
	try {
		return dirname(fileURLToPath(import.meta.url));
	} catch {
		return null;
	}
}
