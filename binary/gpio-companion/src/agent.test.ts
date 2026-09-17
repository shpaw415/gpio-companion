import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentError } from "gpio-companion";
import { createAgentController, memoryAgent } from "./agent.ts";

async function repoDir(): Promise<{ root: string; repo: string }> {
	const root = await mkdtemp(join(tmpdir(), "gpio-agent-"));
	const repo = "blink-led";
	await mkdir(join(root, repo));
	return { root, repo };
}

describe("agent controller", () => {
	test("starts and records last result", async () => {
		const { root, repo } = await repoDir();
		const agent = memoryAgent(async () => ({ ok: true, log: "ok" }), root);
		expect(agent.start({ repo, prompt: "add a blink" })).toEqual({
			started: true,
		});
		expect(agent.status().running).toBe(true);
		await Bun.sleep(20);
		expect(agent.status().running).toBe(false);
		expect(agent.status().last?.ok).toBe(true);
	});

	test("refuses a second job while running", async () => {
		const { root, repo } = await repoDir();
		let release: () => void = () => undefined;
		const hang = new Promise<{ ok: boolean; log: string }>((resolve) => {
			release = () => resolve({ ok: true, log: "done" });
		});
		const agent = memoryAgent(() => hang, root);
		agent.start({ repo, prompt: "one" });
		expect(() => agent.start({ repo, prompt: "two" })).toThrow(
			"already running",
		);
		release();
		await Bun.sleep(20);
	});

	test("needs an existing repo", async () => {
		const root = await mkdtemp(join(tmpdir(), "gpio-agent-empty-"));
		const agent = memoryAgent(undefined, root);
		expect(() => agent.start({ repo: "missing", prompt: "x" })).toThrow(
			AgentError,
		);
	});

	test("stop is idempotent", async () => {
		const { root } = await repoDir();
		const agent = memoryAgent(undefined, root);
		expect(agent.stop()).toEqual({ stopped: true });
	});

	test("stop during run does not hang", async () => {
		const { root, repo } = await repoDir();
		let release: () => void = () => undefined;
		const hang = new Promise<void>((resolve) => {
			release = resolve;
		});
		const agent = createAgentController({
			projectsDir: root,
			async runJob(job) {
				const proc = {
					exited: hang.then(() => 0),
					kill() {
						release();
					},
				};
				job.setProc?.(proc);
				await hang;
				return { ok: true, log: "stopped", proc };
			},
		});
		agent.start({ repo, prompt: "write blink" });
		expect(agent.status().running).toBe(true);
		agent.stop();
		await Bun.sleep(30);
		expect(agent.status().running).toBe(false);
	});
});
