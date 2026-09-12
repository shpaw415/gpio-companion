import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	capRunLog,
	type GpioSnapshot,
	type HardwareId,
	parseRunPut,
	RunError,
	type RunPut,
	type RunResult,
	type RunStatus,
} from "gpio-companion";
import type { GpioController } from "./gpio.ts";

export type RunController = {
	status(): RunStatus;
	start(input: unknown): { started: true };
	stop(): { stopped: true };
};

export type HostRunOptions = {
	hardware: HardwareId | (() => HardwareId | Promise<HardwareId>);
	gpio?: GpioController;
	hostDir?: string;
	compileAndRun?: (job: {
		dir: string;
		pinmapPath: string;
		outPath: string;
		hostDir: string;
	}) => Promise<{ ok: boolean; log: string; proc?: RunProcess }>;
	hasSketch?: (dir: string) => boolean;
};

export type RunProcess = {
	exited: Promise<number>;
	kill(signal?: "SIGTERM" | "SIGKILL"): void;
	stdout?: ReadableStream<Uint8Array> | number;
	stderr?: ReadableStream<Uint8Array> | number;
};

const SKETCH_EXT = [".c", ".ino"];
const COMPILE_MS = 60_000;
const STOP_MS = 2_000;

export function createRunController(options: HostRunOptions): RunController {
	let running = false;
	let log = "";
	let last: RunResult | null = null;
	let current: RunProcess | null = null;
	return {
		status() {
			return { running, log, last };
		},
		start(input) {
			const put = parseRunPut(input);
			assertSketchDir(put.dir, options.hasSketch);
			if (running) {
				throw new RunError("run already running", 409);
			}
			running = true;
			log = "";
			const startedAt = Date.now();
			void runJob(put, options, startedAt, {
				append(text) {
					log = capRunLog(`${log}${text}`);
				},
				setProc(proc) {
					current = proc;
				},
			})
				.then((result) => {
					last = result;
					log = result.log;
				})
				.catch((caught) => {
					last = {
						ok: false,
						dir: put.dir,
						log: capRunLog(
							caught instanceof Error ? caught.message : "run failed",
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
			const proc = current;
			if (proc) {
				try {
					proc.kill("SIGTERM");
				} catch {
					undefined;
				}
				void Promise.race([proc.exited, Bun.sleep(STOP_MS)]).then((done) => {
					if (typeof done !== "number") {
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

export function createHostRun(options: HostRunOptions): RunController {
	return createRunController({
		...options,
		compileAndRun: options.compileAndRun ?? liveCompileAndRun,
	});
}

export function memoryRun(
	upload: (job: RunPut) => Promise<{
		ok: boolean;
		log: string;
		proc?: RunProcess;
	}> = async () => ({ ok: true, log: "ok" }),
	hasSketch = true,
): RunController {
	return createRunController({
		hardware: "raspberrypi",
		hasSketch: () => hasSketch,
		async compileAndRun(job) {
			return upload({ dir: job.dir });
		},
	});
}

function assertSketchDir(
	dir: string,
	hasSketch?: (dir: string) => boolean,
): void {
	if (hasSketch) {
		if (!hasSketch(dir)) {
			throw new RunError("dir needs a .c or .ino sketch");
		}
		return;
	}
	try {
		if (!statSync(dir).isDirectory()) {
			throw new RunError("dir is not a directory");
		}
	} catch (caught) {
		if (caught instanceof RunError) {
			throw caught;
		}
		throw new RunError("dir was not found");
	}
	if (!sketchFiles(dir).length) {
		throw new RunError("dir needs a .c or .ino sketch");
	}
}

async function runJob(
	put: RunPut,
	options: HostRunOptions,
	startedAt: number,
	hooks: {
		append(text: string): void;
		setProc(proc: RunProcess): void;
	},
): Promise<RunResult> {
	const hostDir = options.hostDir ?? resolveHostDir();
	const work = join(tmpdir(), "gpio-companion-run", String(startedAt));
	mkdirSync(work, { recursive: true });
	const pinmapPath = join(work, "pins.txt");
	const outPath = join(work, "sketch");
	if (options.gpio?.releaseAll) {
		await options.gpio.releaseAll();
	}
	const hardware =
		typeof options.hardware === "function"
			? await options.hardware()
			: options.hardware;
	if (options.gpio) {
		writeFileSync(
			pinmapPath,
			formatPinmap(await options.gpio.snapshot(hardware)),
		);
	} else {
		writeFileSync(pinmapPath, `hardware ${hardware}\n`);
	}
	const compile = options.compileAndRun ?? liveCompileAndRun;
	const result = await compile({
		dir: put.dir,
		pinmapPath,
		outPath,
		hostDir,
	});
	if (!result.ok || !result.proc) {
		return {
			ok: result.ok,
			dir: put.dir,
			log: capRunLog(result.log),
			startedAt,
			finishedAt: Date.now(),
		};
	}
	hooks.setProc(result.proc);
	hooks.append(result.log ? `${result.log}\n` : "");
	const [stdout, stderr] = await Promise.all([
		readLive(result.proc.stdout, hooks.append),
		readLive(result.proc.stderr, hooks.append),
	]);
	const code = await result.proc.exited;
	return {
		ok: code === 0,
		dir: put.dir,
		log: capRunLog(`${result.log}\n${stdout}\n${stderr}`.trim()),
		startedAt,
		finishedAt: Date.now(),
	};
}

async function liveCompileAndRun(job: {
	dir: string;
	pinmapPath: string;
	outPath: string;
	hostDir: string;
}): Promise<{ ok: boolean; log: string; proc?: RunProcess }> {
	const sketches = sketchFiles(job.dir);
	if (!sketches.length) {
		return { ok: false, log: "dir needs a .c or .ino sketch" };
	}
	const compile = await spawnResult(
		[
			"gcc",
			"-O2",
			"-Wall",
			"-std=c11",
			"-I",
			job.hostDir,
			"-o",
			job.outPath,
			join(job.hostDir, "main.c"),
			join(job.hostDir, "arduino.c"),
			"-x",
			"c",
			...sketches,
			"-lgpiod",
			"-lpthread",
		],
		COMPILE_MS,
	);
	if (compile.code !== 0) {
		return { ok: false, log: compile.log || "gcc failed" };
	}
	const proc = Bun.spawn([job.outPath, "--pinmap", job.pinmapPath], {
		cwd: job.dir,
		stdout: "pipe",
		stderr: "pipe",
	});
	return {
		ok: true,
		log: compile.log,
		proc,
	};
}

export function formatPinmap(snapshot: GpioSnapshot): string {
	const lines = [`hardware ${snapshot.hardware}`];
	for (const pin of snapshot.pins) {
		if (pin.type === "power") {
			lines.push(`${pin.physical} power`);
			continue;
		}
		if (pin.type === "gnd") {
			lines.push(`${pin.physical} gnd`);
			continue;
		}
		if (pin.reserved) {
			lines.push(`${pin.physical} reserved`);
			continue;
		}
		if (pin.unresolved || !pin.chip || pin.line === undefined) {
			lines.push(`${pin.physical} unresolved`);
			continue;
		}
		const adc = pin.adc !== undefined ? " adc" : "";
		lines.push(`${pin.physical} gpio ${pin.chip} ${pin.line}${adc}`);
	}
	return `${lines.join("\n")}\n`;
}

function sketchFiles(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter((name) => SKETCH_EXT.some((ext) => name.endsWith(ext)))
			.map((name) => join(dir, name));
	} catch {
		return [];
	}
}

function resolveHostDir(): string {
	const installed = "/usr/local/lib/gpio-companion/gpio-host";
	const source = new URL("../../../native/gpio-host", import.meta.url).pathname;
	if (statExists(join(installed, "arduino.c"))) {
		return installed;
	}
	return source;
}

function statExists(path: string): boolean {
	try {
		statSync(path);
		return true;
	} catch {
		return false;
	}
}

async function spawnResult(
	cmd: string[],
	timeoutMs: number,
): Promise<{ code: number; log: string }> {
	const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
	const timed = Promise.race([
		proc.exited,
		Bun.sleep(timeoutMs).then(() => {
			try {
				proc.kill("SIGKILL");
			} catch {
				undefined;
			}
			return 1;
		}),
	]);
	const [stdout, stderr, code] = await Promise.all([
		readPipe(proc.stdout),
		readPipe(proc.stderr),
		timed,
	]);
	return { code, log: `${stdout}\n${stderr}`.trim() };
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

async function readPipe(
	stream: ReadableStream<Uint8Array> | number | undefined,
): Promise<string> {
	if (!stream || typeof stream === "number") {
		return "";
	}
	return new Response(stream).text();
}
