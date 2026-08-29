import {
	DEFAULT_DEVICE_KEY_ID,
	DEFAULT_DEVICE_PUBLIC_KEY_PEM,
	type HardwareId,
	isHardwareId,
	VERSION,
} from "gpio-companion";
import { startBleBridge } from "./ble.ts";
import { DEFAULT_PAIRING_PATH, filePairingStore } from "./pairing.ts";
import { DEFAULT_SECRETS_PATH, fileSecretsStore } from "./secrets.ts";
import { startDeviceApi } from "./serve.ts";
import {
	DEFAULT_CONFIG_PATH,
	DEFAULT_PORT,
	DEFAULT_TUNNEL_ENV_PATH,
	fileConfigStore,
} from "./store.ts";
import { applyCloudflaredReplica } from "./tunnel.ts";
import { applyNetworkManagerWifi } from "./wifi.ts";

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
const pairingPath = process.env.GPIO_COMPANION_PAIRING ?? DEFAULT_PAIRING_PATH;
const pairingUuid = process.env.GPIO_COMPANION_PAIRING_UUID ?? "";
const pairingKey = process.env.GPIO_COMPANION_PAIRING_KEY ?? "";
const port = Number(process.env.GPIO_COMPANION_PORT ?? DEFAULT_PORT);

const deviceKeyId =
	process.env.GPIO_COMPANION_DEVICE_KEY_ID ?? DEFAULT_DEVICE_KEY_ID;
const devicePublicKeyPem =
	process.env.GPIO_COMPANION_DEVICE_PUBLIC_KEY ?? DEFAULT_DEVICE_PUBLIC_KEY_PEM;

const server = startDeviceApi({
	port,
	store: fileConfigStore(configPath, hardware),
	secrets: fileSecretsStore(secretsPath),
	pairing: filePairingStore(pairingPath, pairingUuid, pairingKey),
	applyTunnel: applyCloudflaredReplica(envPath),
	applyWifi: applyNetworkManagerWifi(),
	deviceAuth: {
		keyId: deviceKeyId,
		publicKeyPem: devicePublicKeyPem,
	},
});

startBleBridge({
	pairingUuid,
	hardware,
	port: server.port ?? 4150,
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
