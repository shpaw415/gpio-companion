#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	devicePublicKeySource,
	generateDeviceKeyPair,
} from "../packages/core/src/device-auth.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const DEFAULT_OUT = join(REPO_ROOT, ".device-keys");
const PUBLIC_KEY_MODULE = join(
	REPO_ROOT,
	"packages/core/src/device-public-key.ts",
);

function arg(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return undefined;
	}
	return process.argv[index + 1];
}

function flag(name: string): boolean {
	return process.argv.includes(name);
}

const keyId = arg("--key-id") ?? "gpio-companion-v1";
const outDir = arg("--out") ?? DEFAULT_OUT;
const writePublic = flag("--write-public");
const wrangler = flag("--wrangler");

const keys = await generateDeviceKeyPair(keyId);
await mkdir(outDir, { recursive: true, mode: 0o700 });
const privatePath = join(outDir, `${keyId}.private.pem`);
const publicPath = join(outDir, `${keyId}.public.pem`);
await writeFile(privatePath, keys.privateKeyPem, { mode: 0o600 });
await writeFile(publicPath, keys.publicKeyPem, { mode: 0o644 });

if (writePublic) {
	await writeFile(
		PUBLIC_KEY_MODULE,
		devicePublicKeySource(keyId, keys.publicKeyPem),
	);
}

if (wrangler) {
	const child = Bun.spawn(
		[
			"wrangler",
			"pages",
			"secret",
			"put",
			"GPIO_COMPANION_DEVICE_PRIVATE_KEY",
			"--project-name",
			"gpio-companion-dashboard",
		],
		{
			cwd: join(REPO_ROOT, "apps/dashboard"),
			stdin: new Blob([keys.privateKeyPem]),
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	const code = await child.exited;
	if (code !== 0) {
		process.exit(code);
	}
}

console.log(`key id: ${keyId}`);
console.log(`private: ${privatePath}`);
console.log(`public:  ${publicPath}`);
if (writePublic) {
	console.log(`module:  ${PUBLIC_KEY_MODULE}`);
}
console.log(
	"set dashboard secret GPIO_COMPANION_DEVICE_PRIVATE_KEY from the private pem",
);
console.log("or rerun with --wrangler");
