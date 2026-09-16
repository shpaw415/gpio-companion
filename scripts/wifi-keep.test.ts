import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "wifi-keep.sh");
const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-wifi-keep-"));
	dirs.push(dir);
	return dir;
}

async function bash(scriptText: string, env: Record<string, string> = {}) {
	const proc = Bun.spawn(["bash", "-ec", scriptText], {
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, ...env },
	});
	const [stdout, stderr, exit] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout, stderr, exit };
}

afterAll(async () => {
	await Promise.all(
		dirs.map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

async function fakeBin(dir: string, nmcliBody: string) {
	const bin = join(dir, "bin");
	await mkdir(bin, { recursive: true });
	const log = join(dir, "nmcli.log");
	await writeFile(
		join(bin, "nmcli"),
		`#!/usr/bin/env bash
set -u
echo "nmcli $*" >> "${log}"
${nmcliBody}
`,
	);
	await writeFile(
		join(bin, "modprobe"),
		`#!/usr/bin/env bash
set -u
echo "modprobe $*" >> "${log}"
exit 0
`,
	);
	await chmod(join(bin, "nmcli"), 0o755);
	await chmod(join(bin, "modprobe"), 0o755);
	return { bin, log };
}

describe("wifi-keep", () => {
	test("connected wifi is a no-op", async () => {
		const dir = await tempDir();
		const { bin, log } = await fakeBin(
			dir,
			`
if [[ "\${1:-}" == "-t" ]]; then
	printf '%s\\n' "eth0:ethernet:connected" "wlan0:wifi:connected"
	exit 0
fi
exit 0
`,
		);
		const result = await bash(`PATH="${bin}:$PATH" bash "${script}"`, {
			GPIO_COMPANION_WIFI_KEEP_STATE: join(dir, "state"),
			GPIO_COMPANION_WIFI_KEEP_SLEEP: "0",
		});
		expect(result.exit).toBe(0);
		expect(result.stderr).toContain("connected");
		const calls = await Bun.file(log).text();
		expect(calls).not.toContain("connection up");
		expect(calls).not.toContain("modprobe");
	});

	test("disconnected wifi brings up the saved profile", async () => {
		const dir = await tempDir();
		const { bin, log } = await fakeBin(
			dir,
			`
if [[ "$*" == *connection*up* ]]; then
	exit 0
fi
if [[ "$*" == *connection*show* ]]; then
	printf '%s\\n' "old:802-11-wireless:10" "bench:802-11-wireless:99" "Wired connection 1:802-3-ethernet:50"
	exit 0
fi
if [[ "\${1:-}" == "-t" ]]; then
	printf '%s\\n' "wlan0:wifi:disconnected"
	exit 0
fi
exit 0
`,
		);
		const result = await bash(`PATH="${bin}:$PATH" bash "${script}"`, {
			GPIO_COMPANION_WIFI_KEEP_STATE: join(dir, "state"),
			GPIO_COMPANION_WIFI_KEEP_SLEEP: "0",
		});
		expect(result.exit).toBe(0);
		expect(result.stderr).toContain("up bench");
		const calls = await Bun.file(log).text();
		expect(calls).toContain("connection up bench");
		expect(calls).not.toContain("connection up old");
		expect(calls).not.toContain("connection up Wired");
		expect(calls).not.toContain("modprobe");
	});

	test("reloads brcmfmac after consecutive up failures", async () => {
		const dir = await tempDir();
		const { bin, log } = await fakeBin(
			dir,
			`
if [[ "$*" == *connection*up* ]]; then
	exit 1
fi
if [[ "$*" == *connection*show* ]]; then
	printf '%s\\n' "bench:802-11-wireless:99"
	exit 0
fi
if [[ "\${1:-}" == "-t" ]]; then
	printf '%s\\n' "wlan0:wifi:disconnected"
	exit 0
fi
exit 0
`,
		);
		const env = {
			GPIO_COMPANION_WIFI_KEEP_STATE: join(dir, "state"),
			GPIO_COMPANION_WIFI_KEEP_SLEEP: "0",
			GPIO_COMPANION_WIFI_KEEP_FAILS: "2",
		};
		await bash(`PATH="${bin}:$PATH" bash "${script}"`, env);
		const first = await Bun.file(log).text();
		expect(first).not.toContain("modprobe");
		const second = await bash(`PATH="${bin}:$PATH" bash "${script}"`, env);
		expect(second.exit).toBe(0);
		const calls = await Bun.file(log).text();
		expect(calls).toContain("modprobe -r brcmfmac");
		expect(calls).toContain("modprobe brcmfmac");
	});
});
