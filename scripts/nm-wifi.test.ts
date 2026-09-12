import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const libSh = join(import.meta.dir, "lib.sh");
const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-nm-wifi-"));
	dirs.push(dir);
	return dir;
}

async function bash(script: string, env: Record<string, string> = {}) {
	const proc = Bun.spawn(["bash", "-ec", script], {
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

describe("ensure_networkmanager_wifi", () => {
	test(
		"writes NM drop-in and claims unmanaged wifi",
		async () => {
			const dir = await tempDir();
			const bin = join(dir, "bin");
			const conf = join(dir, "nm");
			const log = join(dir, "nmcli.log");
			await mkdir(bin, { recursive: true });
			await writeFile(
				join(bin, "systemctl"),
				`#!/usr/bin/env bash
set -euo pipefail
exit 0
`,
			);
			await writeFile(
				join(bin, "rfkill"),
				`#!/usr/bin/env bash
set -euo pipefail
echo "rfkill $*" >> "${log}"
exit 0
`,
			);
			await writeFile(
				join(bin, "nmcli"),
				`#!/usr/bin/env bash
set -euo pipefail
echo "nmcli $*" >> "${log}"
if [[ "\${1:-}" == "-t" ]]; then
	printf '%s\\n' "eth0:ethernet:connected" "wlan0:wifi:unmanaged" "wlan1:wifi:disconnected"
	exit 0
fi
exit 0
`,
			);
			await chmod(join(bin, "systemctl"), 0o755);
			await chmod(join(bin, "rfkill"), 0o755);
			await chmod(join(bin, "nmcli"), 0o755);
			const result = await bash(
				`
PATH="${bin}:$PATH"
source "${libSh}"
ensure_networkmanager_wifi
`,
				{
					GPIO_COMPANION_NM_CONF_D: conf,
					GPIO_COMPANION_NETPLAN_DIR: join(dir, "netplan-missing"),
				},
			);
			expect(result.exit).toBe(0);
			expect(result.stdout).toContain("NetworkManager wifi managed");
			const dropIn = await Bun.file(
				join(conf, "90-gpio-companion-wifi.conf"),
			).text();
			expect(dropIn).toContain("managed=true");
			expect(dropIn).toContain("wifi.scan-rand-mac-address=no");
			const calls = await Bun.file(log).text();
			expect(calls).toContain("unblock wifi");
			expect(calls).toContain("radio wifi on");
			expect(calls).toContain("device set wlan0 managed yes");
			expect(calls).not.toContain("device set eth0");
			expect(calls).not.toContain("device set wlan1");
		},
		{
			timeout: 10_000,
		},
	);

	test("moves netplan wifi-only yaml aside", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		const conf = join(dir, "nm");
		const netplan = join(dir, "netplan");
		const bak = join(dir, "bak");
		await mkdir(bin, { recursive: true });
		await mkdir(netplan, { recursive: true });
		await writeFile(
			join(netplan, "10-dhcp-all-interfaces.yaml"),
			"network:\n  ethernets:\n    all-eth-interfaces:\n      dhcp4: yes\n",
		);
		await writeFile(
			join(netplan, "30-wifis-dhcp.yaml"),
			"network:\n  wifis:\n    wlan0:\n      dhcp4: yes\n",
		);
		await writeFile(
			join(bin, "systemctl"),
			`#!/usr/bin/env bash
exit 0
`,
		);
		await writeFile(
			join(bin, "nmcli"),
			`#!/usr/bin/env bash
if [[ "\${1:-}" == "-t" ]]; then
	printf '%s\\n' "wlan0:wifi:disconnected"
	exit 0
fi
exit 0
`,
		);
		await writeFile(
			join(bin, "netplan"),
			`#!/usr/bin/env bash
exit 0
`,
		);
		await chmod(join(bin, "systemctl"), 0o755);
		await chmod(join(bin, "nmcli"), 0o755);
		await chmod(join(bin, "netplan"), 0o755);
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
ensure_networkmanager_wifi
`,
			{
				GPIO_COMPANION_NM_CONF_D: conf,
				GPIO_COMPANION_NETPLAN_DIR: netplan,
				GPIO_COMPANION_NETPLAN_BAK: bak,
			},
		);
		expect(result.exit).toBe(0);
		expect(
			await Bun.file(join(netplan, "10-dhcp-all-interfaces.yaml")).exists(),
		).toBe(true);
		expect(await Bun.file(join(netplan, "30-wifis-dhcp.yaml")).exists()).toBe(
			false,
		);
		expect(await Bun.file(join(bak, "30-wifis-dhcp.yaml")).exists()).toBe(true);
		expect(
			await Bun.file(join(netplan, "90-gpio-companion-wifi.yaml")).text(),
		).toContain("renderer: NetworkManager");
	});

	test("skips claim when nmcli is missing", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		const conf = join(dir, "nm");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "systemctl"),
			`#!/usr/bin/env bash
exit 0
`,
		);
		await chmod(join(bin, "systemctl"), 0o755);
		for (const name of ["mkdir", "cat", "chmod"]) {
			const proc = Bun.spawnSync(["bash", "-lc", `command -v ${name}`], {
				stdout: "pipe",
			});
			const src = new TextDecoder().decode(proc.stdout).trim();
			if (src) {
				await Bun.spawn(["ln", "-s", src, join(bin, name)]).exited;
			}
		}
		const result = await bash(
			`
PATH="${bin}"
source "${libSh}"
ensure_networkmanager_wifi
`,
			{
				GPIO_COMPANION_NM_CONF_D: conf,
				GPIO_COMPANION_NETPLAN_DIR: join(dir, "netplan-missing"),
			},
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("nmcli missing");
		const dropIn = await Bun.file(
			join(conf, "90-gpio-companion-wifi.conf"),
		).text();
		expect(dropIn).toContain("[ifupdown]");
	});
});
