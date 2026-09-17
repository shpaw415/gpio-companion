import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	AgentError,
	type AgentPut,
	type AgentResult,
	type AgentStatus,
	capAgentLog,
	parseAgentPut,
} from "gpio-companion";
import { killTree } from "./gpio.ts";
import { projectsRoot } from "./projects.ts";

export type AgentController = {
	status(): AgentStatus;
	start(input: unknown): { started: true };
	stop(): { stopped: true };
};

export type AgentProcess = {
	pid?: number;
	exited: Promise<number>;
	kill(signal?: "SIGTERM" | "SIGKILL"): void;
	stdout?: ReadableStream<Uint8Array> | number;
	stderr?: ReadableStream<Uint8Array> | number;
};

export type AgentOptions = {
	projectsDir?: string;
	opencodeBin?: string;
	runJob?: (job: {
		dir: string;
		prompt: string;
		bin: string;
		setProc?: (proc: AgentProcess | null) => void;
		cancelled?: () => boolean;
	}) => Promise<{ ok: boolean; log: string; proc?: AgentProcess }>;
};

const STOP_MS = 2_000;
const AGENT_MS = 10 * 60_000;

export function createAgentController(
	options: AgentOptions = {},
): AgentController {
	let running = false;
	let cancelled = false;
	let log = "";
	let last: AgentResult | null = null;
	let current: AgentProcess | null = null;
	return {
		status() {
			return { running, log, last };
		},
		start(input) {
			const put = parseAgentPut(input);
			const dir = resolveRepoDir(put.repo, options.projectsDir);
			if (running) {
				throw new AgentError("agent already running", 409);
			}
			running = true;
			cancelled = false;
			log = "";
			const startedAt = Date.now();
			void execute(put, dir, options, startedAt, {
				append(text) {
					log = capAgentLog(`${log}${text}`);
				},
				setProc(proc) {
					current = proc;
				},
				cancelled() {
					return cancelled;
				},
			})
				.then((result) => {
					last = result;
					log = result.log;
				})
				.catch((caught) => {
					last = {
						ok: false,
						repo: put.repo,
						log: capAgentLog(
							caught instanceof Error ? caught.message : "agent failed",
						),
						startedAt,
						finishedAt: Date.now(),
					};
					log = last.log;
				})
				.finally(() => {
					current = null;
					running = false;
				});
			return { started: true };
		},
		stop() {
			cancelled = true;
			const proc = current;
			if (proc) {
				void killTree(proc).then(async () => {
					const done = await Promise.race([
						proc.exited.then(() => true),
						Bun.sleep(STOP_MS).then(() => false),
					]);
					if (!done) {
						try {
							proc.kill("SIGKILL");
						} catch {
							undefined;
						}
					}
				});
			}
			return { stopped: true };
		},
	};
}

export function memoryAgent(
	upload: (job: AgentPut) => Promise<{
		ok: boolean;
		log: string;
		proc?: AgentProcess;
	}> = async () => ({ ok: true, log: "ok" }),
	projectsDir?: string,
): AgentController {
	return createAgentController({
		projectsDir,
		async runJob(job) {
			return upload({ repo: job.dir, prompt: job.prompt });
		},
	});
}

function resolveRepoDir(repo: string, projectsDir?: string): string {
	const root = projectsDir ?? projectsRoot();
	const dir = join(root, repo);
	if (!dir.startsWith(root) || dir.includes("..")) {
		throw new AgentError("repo is invalid");
	}
	try {
		if (!statSync(dir).isDirectory()) {
			throw new AgentError("repo was not found");
		}
	} catch (caught) {
		if (caught instanceof AgentError) {
			throw caught;
		}
		throw new AgentError("repo was not found");
	}
	return dir;
}

async function execute(
	put: AgentPut,
	dir: string,
	options: AgentOptions,
	startedAt: number,
	hooks: {
		append(text: string): void;
		setProc(proc: AgentProcess | null): void;
		cancelled(): boolean;
	},
): Promise<AgentResult> {
	if (hooks.cancelled()) {
		return {
			ok: true,
			repo: put.repo,
			log: "stopped",
			startedAt,
			finishedAt: Date.now(),
		};
	}
	const bin = options.opencodeBin ?? resolveOpencodeBin();
	const run = options.runJob ?? liveOpencodeRun;
	const result = await run({
		dir,
		prompt: put.prompt,
		bin,
		setProc: hooks.setProc,
		cancelled: hooks.cancelled,
	});
	if (hooks.cancelled()) {
		if (result.proc) {
			await killTree(result.proc);
		}
		return {
			ok: true,
			repo: put.repo,
			log: capAgentLog(result.log || "stopped"),
			startedAt,
			finishedAt: Date.now(),
		};
	}
	if (!result.proc) {
		return {
			ok: result.ok,
			repo: put.repo,
			log: capAgentLog(result.log),
			startedAt,
			finishedAt: Date.now(),
		};
	}
	hooks.setProc(result.proc);
	const [stdout, stderr] = await Promise.all([
		readLive(result.proc.stdout, hooks.append),
		readLive(result.proc.stderr, hooks.append),
	]);
	const code = await result.proc.exited;
	return {
		ok: result.ok && code === 0,
		repo: put.repo,
		log: capAgentLog(`${result.log}\n${stdout}\n${stderr}`.trim()),
		startedAt,
		finishedAt: Date.now(),
	};
}

async function liveOpencodeRun(job: {
	dir: string;
	prompt: string;
	bin: string;
	setProc?: (proc: AgentProcess | null) => void;
	cancelled?: () => boolean;
}): Promise<{ ok: boolean; log: string; proc?: AgentProcess }> {
	if (job.cancelled?.()) {
		return { ok: true, log: "stopped" };
	}
	if (!existsSync(job.bin)) {
		return { ok: false, log: "opencode not found" };
	}
	const proc = Bun.spawn(
		[job.bin, "run", "--dir", job.dir, "--auto", job.prompt],
		{
			cwd: job.dir,
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	job.setProc?.(proc);
	void Promise.race([
		proc.exited,
		Bun.sleep(AGENT_MS).then(() => {
			try {
				proc.kill("SIGKILL");
			} catch {
				undefined;
			}
		}),
	]);
	return { ok: true, log: "", proc };
}

function resolveOpencodeBin(): string {
	const wrapper = "/usr/local/bin/opencode";
	if (existsSync(wrapper)) {
		return wrapper;
	}
	return "opencode";
}

async function readLive(
	stream: ReadableStream<Uint8Array> | number | undefined,
	append: (text: string) => void,
): Promise<string> {
	if (!stream || typeof stream === "number") {
		return "";
	}
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let text = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		const chunk = decoder.decode(value, { stream: true });
		text += chunk;
		append(chunk);
	}
	return text;
}
