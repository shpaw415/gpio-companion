import { type HardwareId, isHardwareId, VERSION } from "gpio-companion";
import { DEFAULT_SECRETS_PATH, fileSecretsStore } from "./secrets.ts";
import { startDeviceApi } from "./serve.ts";
import {
	DEFAULT_CONFIG_PATH,
	DEFAULT_PORT,
	DEFAULT_TUNNEL_ENV_PATH,
	fileConfigStore,
} from "./store.ts";
import { applyCloudflaredReplica } from "./tunnel.ts";

const command = process.argv[2] ?? "serve";

if (command === "version" || command === "-v" || command === "--version") {
	console.log(VERSION);
	process.exit(0);
}

if (command !== "serve") {
	console.error("usage: gpio-companion serve | version");
	process.exit(1);
}

const hardware = readHardware();
const configPath = process.env.GPIO_COMPANION_CONFIG ?? DEFAULT_CONFIG_PATH;
const envPath =
	process.env.GPIO_COMPANION_TUNNEL_ENV ?? DEFAULT_TUNNEL_ENV_PATH;
const secretsPath = process.env.GPIO_COMPANION_SECRETS ?? DEFAULT_SECRETS_PATH;
const port = Number(process.env.GPIO_COMPANION_PORT ?? DEFAULT_PORT);

const server = startDeviceApi({
	port,
	store: fileConfigStore(configPath, hardware),
	secrets: fileSecretsStore(secretsPath),
	applyTunnel: applyCloudflaredReplica(envPath),
});

console.log(
	`gpio-companion device API on http://${server.hostname}:${server.port}`,
);

function readHardware(): HardwareId {
	const value = process.env.GPIO_COMPANION_HARDWARE ?? "raspberrypi";
	if (!isHardwareId(value)) {
		console.error(`invalid GPIO_COMPANION_HARDWARE: ${value}`);
		process.exit(1);
	}
	return value;
}
