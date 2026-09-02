import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const libSh = join(import.meta.dir, "lib.sh");
const dirs: string[] = [];

async function tempDir() {
	const dir = await mkdtemp(join(tmpdir(), "gpio-t3-"));
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

async function stubPath() {
	const dir = await tempDir();
	const bin = join(dir, "bin");
	await mkdir(bin, { recursive: true });
	const npm = join(bin, "npm");
	const t3 = join(bin, "t3");
	await writeFile(
		npm,
		`#!/usr/bin/env bash
set -euo pipefail
log="\${GPIO_T3_NPM_LOG:?}"
printf '%s\\n' "$*" >> "$log"
if [[ "\${1:-}" == "list" ]]; then
	echo "/usr/lib"
	if [[ -n "\${GPIO_T3_INSTALLED:-}" ]]; then
		echo "└── t3@\${GPIO_T3_INSTALLED}"
		exit 0
	fi
	echo "└── (empty)"
	exit 1
fi
if [[ "\${1:-}" == "view" && "\${2:-}" == "t3" && "\${3:-}" == "version" ]]; then
	if [[ -z "\${GPIO_T3_LATEST:-}" ]]; then
		exit 1
	fi
	printf '%s\\n' "$GPIO_T3_LATEST"
	exit 0
fi
if [[ "\${1:-}" == "install" ]]; then
	exit 0
fi
exit 1
`,
	);
	await writeFile(
		t3,
		`#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "\${GPIO_T3_CMD_LOG:?}"
exit 0
`,
	);
	await chmod(npm, 0o755);
	await chmod(t3, 0o755);
	return { dir, bin };
}

function t3Env(
	dir: string,
	extra: Record<string, string> = {},
): Record<string, string> {
	return {
		GPIO_COMPANION_T3_HOME: join(dir, ".t3"),
		GPIO_COMPANION_T3_SKIP_RESTART: "1",
		...extra,
	};
}

afterAll(async () => {
	await Promise.all(
		dirs.map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("t3@latest updater", () => {
	test("skips npm install when installed matches latest", async () => {
		const { dir, bin } = await stubPath();
		const npmLog = join(dir, "npm.log");
		const t3Log = join(dir, "t3.log");
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
update_t3code 0
`,
			t3Env(dir, {
				GPIO_T3_NPM_LOG: npmLog,
				GPIO_T3_CMD_LOG: t3Log,
				GPIO_T3_INSTALLED: "1.2.3",
				GPIO_T3_LATEST: "1.2.3",
			}),
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("t3 1.2.3 is current");
		const npmCalls = await Bun.file(npmLog).text();
		expect(npmCalls).not.toContain("install -g t3@latest");
		expect(await Bun.file(t3Log).text()).toContain("service install");
	});

	test("installs t3@latest when behind", async () => {
		const { dir, bin } = await stubPath();
		const npmLog = join(dir, "npm.log");
		const t3Log = join(dir, "t3.log");
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
update_t3code 0
`,
			t3Env(dir, {
				GPIO_T3_NPM_LOG: npmLog,
				GPIO_T3_CMD_LOG: t3Log,
				GPIO_T3_INSTALLED: "1.2.3",
				GPIO_T3_LATEST: "1.4.0",
			}),
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("t3 1.2.3 -> 1.4.0");
		expect(await Bun.file(npmLog).text()).toContain("install -g t3@latest");
		expect(await Bun.file(t3Log).text()).toContain("service install");
	});

	test("installs t3@latest when t3 is missing", async () => {
		const { dir, bin } = await stubPath();
		const npmLog = join(dir, "npm.log");
		const t3Log = join(dir, "t3.log");
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
update_t3code 0
`,
			t3Env(dir, {
				GPIO_T3_NPM_LOG: npmLog,
				GPIO_T3_CMD_LOG: t3Log,
				GPIO_T3_INSTALLED: "",
				GPIO_T3_LATEST: "2.0.0",
			}),
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("t3 none -> 2.0.0");
		expect(await Bun.file(npmLog).text()).toContain("install -g t3@latest");
	});

	test("keeps current when t3@latest cannot be resolved", async () => {
		const { dir, bin } = await stubPath();
		const npmLog = join(dir, "npm.log");
		const t3Log = join(dir, "t3.log");
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
update_t3code 0
`,
			t3Env(dir, {
				GPIO_T3_NPM_LOG: npmLog,
				GPIO_T3_CMD_LOG: t3Log,
				GPIO_T3_INSTALLED: "1.2.3",
				GPIO_T3_LATEST: "",
			}),
		);
		expect(result.exit).toBe(0);
		expect(result.stderr).toContain("t3@latest unavailable");
		expect(await Bun.file(npmLog).text()).not.toContain("install -g t3@latest");
		expect(await Bun.file(t3Log).text()).toContain("service install");
	});

	test("force reinstalls t3@latest even when current", async () => {
		const { dir, bin } = await stubPath();
		const npmLog = join(dir, "npm.log");
		const t3Log = join(dir, "t3.log");
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
update_t3code 1
`,
			t3Env(dir, {
				GPIO_T3_NPM_LOG: npmLog,
				GPIO_T3_CMD_LOG: t3Log,
				GPIO_T3_INSTALLED: "1.2.3",
				GPIO_T3_LATEST: "1.2.3",
			}),
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("t3 1.2.3 -> 1.2.3");
		expect(await Bun.file(npmLog).text()).toContain("install -g t3@latest");
	});

	test("install_t3code uses t3@latest", async () => {
		const { dir, bin } = await stubPath();
		const npmLog = join(dir, "npm.log");
		const t3Log = join(dir, "t3.log");
		const result = await bash(
			`
PATH="${bin}:$PATH"
source "${libSh}"
GPIO_USER=root
install_t3code
`,
			t3Env(dir, {
				GPIO_T3_NPM_LOG: npmLog,
				GPIO_T3_CMD_LOG: t3Log,
			}),
		);
		expect(result.exit).toBe(0);
		expect(await Bun.file(npmLog).text()).toContain("install -g t3@latest");
		expect(await Bun.file(t3Log).text()).toContain("service install");
	});

	test("locks T3 Code to OpenCode only", async () => {
		const dir = await tempDir();
		const settings = join(dir, ".t3", "userdata", "settings.json");
		await mkdir(join(dir, ".t3", "userdata"), { recursive: true });
		await writeFile(
			settings,
			JSON.stringify({
				providers: {
					cursor: { enabled: true },
					grok: { enabled: true },
					opencode: { enabled: false },
				},
				providerInstances: {
					claudeAgent: { driver: "claudeAgent", enabled: true },
					codex: { driver: "codex", enabled: true },
					opencode: { driver: "opencode", enabled: false },
				},
			}),
		);
		const result = await bash(
			`
source "${libSh}"
GPIO_USER=root
configure_t3_opencode_only
`,
			t3Env(dir),
		);
		expect(result.exit).toBe(0);
		expect(result.stdout).toContain("T3 Code providers locked to OpenCode");
		const saved = JSON.parse(await Bun.file(settings).text()) as {
			providers: Record<string, { enabled: boolean }>;
			providerInstances: Record<string, { driver: string; enabled: boolean }>;
		};
		expect(saved.providers.opencode.enabled).toBe(true);
		expect(saved.providers.cursor.enabled).toBe(false);
		expect(saved.providers.grok.enabled).toBe(false);
		expect(saved.providerInstances.opencode.enabled).toBe(true);
		expect(saved.providerInstances.claudeAgent.enabled).toBe(false);
		expect(saved.providerInstances.codex.enabled).toBe(false);
	});

	test("creates an OpenCode instance when settings are missing", async () => {
		const dir = await tempDir();
		const result = await bash(
			`
source "${libSh}"
GPIO_USER=root
configure_t3_opencode_only
`,
			t3Env(dir),
		);
		expect(result.exit).toBe(0);
		const saved = JSON.parse(
			await Bun.file(join(dir, ".t3", "userdata", "settings.json")).text(),
		) as {
			providerInstances: { opencode: { enabled: boolean; driver: string } };
		};
		expect(saved.providerInstances.opencode.driver).toBe("opencode");
		expect(saved.providerInstances.opencode.enabled).toBe(true);
	});
});
