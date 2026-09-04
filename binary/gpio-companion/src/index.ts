import { existsSync, readFileSync } from "node:fs";
import {
	DEFAULT_DEVICE_KEY_ID,
	type HardwareId,
	isHardwareId,
	parseDeviceConfig,
	publicDeviceUrl,
	VERSION,
} from "gpio-companion";
import { startBleBridge } from "./ble.ts";
import {
	fetchGithubCredentials,
	loadGithubCreds,
	persistGithubLogin,
	runGitCredentialHelper,
} from "./github-credentials.ts";
import { startLivePing } from "./live-ping.ts";
import { DEFAULT_PAIRING_PATH, filePairingStore } from "./pairing.ts";
import { DEFAULT_SECRETS_PATH, fileSecretsStore } from "./secrets.ts";
import { startDeviceApi } from "./serve.ts";
import {
	DEFAULT_CLOCK_STAMP_PATH,
	DEFAULT_CONFIG_PATH,
	DEFAULT_DEVICE_AUTH_PATH,
	DEFAULT_NONCE_PATH,
	DEFAULT_PORT,
	DEFAULT_TUNNEL_ENV_PATH,
	fileConfigStore,
} from "./store.ts";
import { liveT3Controller } from "./t3.ts";
import { applyCloudflaredReplica } from "./tunnel.ts";
import { applySystemdUpdate } from "./update.ts";
import { applyNetworkManagerWifi } from "./wifi.ts";

const command = process.argv[2] ?? "serve";

if (command === "version" || command === "-v" || command === "--version") {
	console.log(VERSION);
	process.exit(0);
}

if (command === "git-credential" || command === "github-token") {
	const pairingUuid = process.env.GPIO_COMPANION_PAIRING_UUID ?? "";
	const pairingKey = process.env.GPIO_COMPANION_PAIRING_KEY ?? "";
	const port = Number(process.env.GPIO_COMPANION_PORT ?? DEFAULT_PORT);
	try {
		if (command === "github-token") {
			const creds = await loadGithubCreds(pairingUuid, pairingKey, port);
			process.stdout.write(`${creds.token}\n`);
			process.exit(0);
		}
		const output = await runGitCredentialHelper(
			process.argv[3] ?? "get",
			await Bun.stdin.text(),
			{ uuid: pairingUuid, key: pairingKey },
		);
		process.stdout.write(output);
		process.exit(0);
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : "github failed";
		console.error(message);
		process.exit(1);
	}
}

if (command !== "serve") {
	console.error(
		"usage: gpio-companion serve | version | git-credential | github-token",
	);
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
const secrets = fileSecretsStore(secretsPath);
const pairing = filePairingStore(pairingPath, pairingUuid, pairingKey);

const deviceAuth = loadDeviceAuth();

const t3 = liveT3Controller();
const githubCredentials = async () => {
	const state = await pairing.read();
	const creds = await fetchGithubCredentials({
		uuid: state.uuid || pairingUuid,
		key: state.key || pairingKey,
	});
	await persistGithubLogin(secrets, creds);
	return creds;
};
const server = startDeviceApi({
	port,
	store: fileConfigStore(configPath, hardware),
	secrets,
	pairing,
	applyTunnel: applyCloudflaredReplica(envPath),
	applyWifi: applyNetworkManagerWifi(),
	applyUpdate: applySystemdUpdate(),
	t3,
	revokeT3: () => t3.revoke(),
	deviceAuth,
	githubCredentials,
	clockStampPath:
		process.env.GPIO_COMPANION_CLOCK_STAMP ?? DEFAULT_CLOCK_STAMP_PATH,
	noncePath: process.env.GPIO_COMPANION_NONCES ?? DEFAULT_NONCE_PATH,
});
setInterval(
	() => {
		void githubCredentials().catch(() => undefined);
	},
	30 * 60 * 1000,
);

startBleBridge({
	pairingUuid,
	hardware,
	port: server.port ?? 4150,
	deviceUrl: readDeviceUrl(configPath),
});
startLivePing({ uuid: pairingUuid });

console.log(
	`gpio-companion device API on http://${server.hostname}:${server.port}`,
);

function loadDeviceAuth(): { keyId: string; publicKeyPem: string } {
	const authPath =
		process.env.GPIO_COMPANION_DEVICE_AUTH ?? DEFAULT_DEVICE_AUTH_PATH;
	let keyId = process.env.GPIO_COMPANION_DEVICE_KEY_ID ?? DEFAULT_DEVICE_KEY_ID;
	let publicKeyPem = process.env.GPIO_COMPANION_DEVICE_PUBLIC_KEY ?? "";
	if (existsSync(authPath)) {
		try {
			const parsed = JSON.parse(readFileSync(authPath, "utf8")) as {
				keyId?: unknown;
				publicKeyPem?: unknown;
			};
			if (!process.env.GPIO_COMPANION_DEVICE_KEY_ID) {
				if (typeof parsed.keyId === "string" && parsed.keyId.trim()) {
					keyId = parsed.keyId.trim();
				}
			}
			if (!process.env.GPIO_COMPANION_DEVICE_PUBLIC_KEY) {
				if (
					typeof parsed.publicKeyPem === "string" &&
					parsed.publicKeyPem.trim()
				) {
					publicKeyPem = parsed.publicKeyPem;
				}
			}
		} catch {
			// keep env / defaults
		}
	}
	return { keyId, publicKeyPem };
}

function readDeviceUrl(path: string): string {
	if (!existsSync(path)) {
		return "";
	}
	try {
		return publicDeviceUrl(
			parseDeviceConfig(JSON.parse(readFileSync(path, "utf8"))).tunnel
				.apiHostname,
		);
	} catch {
		return "";
	}
}

function readHardware(): HardwareId {
	const value = process.env.GPIO_COMPANION_HARDWARE ?? "raspberrypi";
	if (!isHardwareId(value)) {
		console.error(`invalid GPIO_COMPANION_HARDWARE: ${value}`);
		process.exit(1);
	}
	return value;
}
