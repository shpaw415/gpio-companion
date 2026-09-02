import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const libSh = join(import.meta.dir, "lib.sh");
const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-oc-"));
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

describe("opencode upgrade", () => {
	test("runs opencode upgrade when present", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		await mkdir(bin, { recursive: true });
		const log = join(dir, "oc.log");
		await writeFile(
			join(bin, "opencode"),
			`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${GPIO_OC_LOG:?}"
exit 0
`,
		);
		await chmod(join(bin, "opencode"), 0o755);
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
update_opencode
`,
			{ GPIO_OC_LOG: log },
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("opencode upgrade");
		expect(await Bun.file(log).text()).toContain("upgrade");
	});

	test("skips when opencode is missing", async () => {
		const dir = await tempDir();
		const bin = join(dir, "bin");
		await mkdir(bin, { recursive: true });
		const result = await bash(
			`
PATH="${bin}"
source "${libSh}"
GPIO_USER=root
update_opencode
`,
		);
		expect(result.exit).toBe(1);
		expect(result.stderr).toContain("opencode not found");
	});
});
