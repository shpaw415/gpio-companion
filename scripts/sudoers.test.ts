import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const libSh = join(import.meta.dir, "lib.sh");
const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-sudo-"));
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

describe("grant_gpio_user_nopasswd_sudo", () => {
	test("writes NOPASSWD drop-in for the GPIO user", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		const sudoers = join(dir, "sudoers.d");
		await mkdir(bin, { recursive: true });
		await writeFile(
			join(bin, "visudo"),
			`#!/usr/bin/env bash
set -euo pipefail
exit 0
`,
		);
		await writeFile(
			join(bin, "getent"),
			`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == passwd && "\${2:-}" == agent ]]; then
	echo "agent:x:1000:1000::/home/agent:"
	exit 0
fi
exit 2
`,
		);
		await chmod(join(bin, "visudo"), 0o755);
		await chmod(join(bin, "getent"), 0o755);
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=agent
grant_gpio_user_nopasswd_sudo
`,
			{ GPIO_COMPANION_SUDOERS_D: sudoers },
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("passwordless sudo granted to agent");
		const dropIn = await Bun.file(join(sudoers, "gpio-companion")).text();
		expect(dropIn).toBe(
			"Defaults:agent !requiretty\nagent ALL=(ALL:ALL) NOPASSWD: ALL\n",
		);
	});

	test("skips root", async () => {
		const dir = await tempDir();
		const sudoers = join(dir, "sudoers.d");
		const result = await bash(
			`
source "${libSh}"
GPIO_USER=root
grant_gpio_user_nopasswd_sudo
`,
			{ GPIO_COMPANION_SUDOERS_D: sudoers },
		);
		expect(result.exit).toBe(0);
		expect(await Bun.file(join(sudoers, "gpio-companion")).exists()).toBe(
			false,
		);
	});

	test("rejects unsafe usernames", async () => {
		const result = await bash(
			`
source "${libSh}"
GPIO_USER='agent;reboot'
grant_gpio_user_nopasswd_sudo
`,
		);
		expect(result.exit).toBe(1);
		expect(result.stderr).toContain("invalid GPIO_USER for sudoers");
	});
});

describe("install_update_wrapper", () => {
	test("writes sudo -n wrappers on PATH", async () => {
		const dir = await tempDir();
		const sbin = join(dir, "sbin");
		const bin = join(dir, "bin");
		const result = await bash(
			`
source "${libSh}"
install_update_wrapper
`,
			{
				GPIO_COMPANION_SBIN_DIR: sbin,
				GPIO_COMPANION_BIN_DIR: bin,
			},
		);
		expect(result.exit).toBe(0);
		const update = await Bun.file(join(sbin, "gpio-companion-update")).text();
		expect(update).toContain("exec sudo -n --");
		expect(update).toContain("scripts/update-script.sh");
		expect(update).not.toContain(" --force ");
		const force = await Bun.file(
			join(sbin, "gpio-companion-force-update"),
		).text();
		expect(force).toContain('update-script.sh" --force');
		expect(
			(await Bun.file(join(bin, "gpio-companion-update")).text()) === update,
		).toBe(true);
	});
});

describe("ensure_root", () => {
	test("re-execs with sudo -n when not root", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		await mkdir(bin, { recursive: true });
		const log = join(dir, "sudo.log");
		const script = join(dir, "job.sh");
		await writeFile(
			join(bin, "id"),
			`#!/usr/bin/env bash
if [[ "\${1:-}" == -u ]]; then
	echo 1000
	exit 0
fi
exec /usr/bin/id "$@"
`,
		);
		await writeFile(
			join(bin, "sudo"),
			`#!/usr/bin/env bash
printf '%s\\n' "$*" >> "\${GPIO_SUDO_LOG:?}"
exit 0
`,
		);
		await chmod(join(bin, "id"), 0o755);
		await chmod(join(bin, "sudo"), 0o755);
		await writeFile(
			script,
			`#!/usr/bin/env bash
set -euo pipefail
source "${libSh}"
ensure_root
echo should-not-run
`,
		);
		await chmod(script, 0o755);
		const result = await bash(`PATH="${bin}:$PATH" "${script}"`, {
			GPIO_SUDO_LOG: log,
		});
		expect(result.exit).toBe(0);
		expect(result.stdout).not.toContain("should-not-run");
		expect(await Bun.file(log).text()).toContain(`-n -- ${script}`);
	});
});
