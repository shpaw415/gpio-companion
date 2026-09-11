import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const libSh = join(import.meta.dir, "lib.sh");
const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-unit-"));
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

describe("write_gpio_companion_service", () => {
	test("runs the API as the GPIO user", async () => {
		const dir = await tempDir();
		const dest = join(dir, "gpio-companion.service");
		const result = await bash(
			`
source "${libSh}"
GPIO_USER=companion
write_gpio_companion_service orangepi
`,
			{ GPIO_COMPANION_SERVICE_UNIT: dest },
		);
		expect(result.exit).toBe(0);
		expect(result.stderr).toBe("");
		const unit = await Bun.file(dest).text();
		expect(unit).toContain("User=companion");
		expect(unit).toContain("Group=companion");
		expect(unit).toContain("Environment=GPIO_USER=companion");
		expect(unit).toContain("Environment=GPIO_COMPANION_HARDWARE=orangepi");
		expect(unit).not.toContain("__GPIO_USER__");
	});
});

describe("resolve_gpio_runtime_user", () => {
	test("keeps a non-root GPIO_USER", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		await mkdir(bin, { recursive: true });
		await Bun.write(
			join(bin, "getent"),
			`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == passwd && "\${2:-}" == companion ]]; then
	echo "companion:x:1000:1000::/home/companion:"
	exit 0
fi
exit 2
`,
		);
		await chmod(join(bin, "getent"), 0o755);
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=companion
resolve_gpio_runtime_user
printf '%s\\n' "$GPIO_USER"
`,
		);
		expect(result.exit).toBe(0);
		expect(result.stdout.trim()).toBe("companion");
	});

	test("uses SUDO_USER when GPIO_USER is root", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		await mkdir(bin, { recursive: true });
		await Bun.write(
			join(bin, "getent"),
			`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == passwd && "\${2:-}" == companion ]]; then
	echo "companion:x:1000:1000::/home/companion:"
	exit 0
fi
exit 2
`,
		);
		await chmod(join(bin, "getent"), 0o755);
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
resolve_gpio_runtime_user
printf '%s\\n' "$GPIO_USER"
`,
			{ SUDO_USER: "companion" },
		);
		expect(result.exit).toBe(0);
		expect(result.stdout.trim()).toBe("companion");
	});
});
