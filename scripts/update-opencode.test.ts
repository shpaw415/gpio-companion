import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	DEFAULT_AI_MODEL,
	opencodeProviderModels,
} from "../packages/core/src/ai-pricing.ts";

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

describe("write_opencode_ai_provider", () => {
	test("writes priced LLMs and thinking-effort variants", async () => {
		const dir = await tempDir();
		const home = join(dir, "opencode");
		const result = await bash(
			`
source "${libSh}"
GPIO_USER=root
GPIO_COMPANION_T3_SKIP_RESTART=1
write_opencode_ai_provider "test-key"
`,
			{
				GPIO_COMPANION_OPENCODE_HOME: home,
				GPIO_COMPANION_T3_SKIP_RESTART: "1",
			},
		);
		expect(result.exit).toBe(0);
		const config = JSON.parse(
			await Bun.file(join(home, "opencode.json")).text(),
		) as {
			model: string;
			provider: {
				"gpio-companion": {
					options: { baseURL: string; apiKey: string };
					models: Record<
						string,
						{
							name: string;
							variants?: Record<string, { reasoningEffort: string }>;
						}
					>;
				};
			};
		};
		const provider = config.provider["gpio-companion"];
		expect(provider.options.baseURL).toBe("http://127.0.0.1:4150/v1/ai");
		expect(provider.options.apiKey).toBe("local");
		const models = provider.models;
		expect(Object.keys(models).sort()).toEqual(
			Object.keys(opencodeProviderModels()).sort(),
		);
		expect(config.model).toBe(`gpio-companion/${DEFAULT_AI_MODEL}`);
		expect(models[DEFAULT_AI_MODEL]?.name).toBe("GLM-5.3");
		expect(models[DEFAULT_AI_MODEL]?.variants).toEqual({
			low: { reasoningEffort: "low" },
			medium: { reasoningEffort: "medium" },
			high: { reasoningEffort: "high" },
		});
		expect(models["@cf/meta/llama-3.2-1b-instruct"]?.variants).toBeUndefined();
	});
});
