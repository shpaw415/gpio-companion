import {
	analogToPwmPercent,
	assertGpioDrive,
	GPIO_MAX_PWM,
	GPIO_PWM_HZ,
	GPIO_RESERVED_PHYSICAL,
	type GpioApply,
	type GpioDir,
	GpioError,
	type GpioPinState,
	type GpioSnapshot,
	gpioNamedLine,
	type HardwareId,
	type HeaderPinDef,
	headerPinsForBoard,
	isGpioNoTone,
	isGpioTone,
	parseGpioChips,
	resolveSkuChip,
	skuPinout,
} from "gpio-companion";
import { existsSync } from "node:fs";
import { readBoardModel } from "./board-model.ts";
import { privileged } from "./priv.ts";

export type GpioInfoLine = {
	chip: string;
	line: number;
	name: string;
	dir?: GpioDir;
};

export type GpioLineRef = {
	chip: string;
	line: number;
	name: string;
};

export type GpioLive = {
	dir?: GpioDir;
	value?: 0 | 1;
	analog?: number;
	hz?: number;
};

export type GpioBackend = {
	gpioinfo(): Promise<string>;
	readall(): Promise<string>;
	get(ref: GpioLineRef): Promise<GpioLive>;
	set(ref: GpioLineRef, dir: GpioDir, value?: 0 | 1): Promise<void>;
	pwm?(): Promise<Map<number, number>>;
	analogWrite?(ref: GpioLineRef, analog: number): Promise<void>;
	tone?(ref: GpioLineRef, hz: number): Promise<void>;
	noTone?(ref: GpioLineRef): Promise<void>;
};

export type GpioController = {
	snapshot(hardware: HardwareId): Promise<GpioSnapshot>;
	apply(hardware: HardwareId, put: GpioApply): Promise<GpioSnapshot>;
};

export type GpioControllerOptions = {
	model?: string | (() => string | undefined);
};

export function parseGpioinfo(text: string): GpioInfoLine[] {
	const lines: GpioInfoLine[] = [];
	let chip = "";
	for (const raw of text.split("\n")) {
		const chipMatch = /^(gpiochip\d+)\b/.exec(raw.trim());
		if (chipMatch?.[1]) {
			chip = chipMatch[1];
			continue;
		}
		const lineMatch = /^\s*line\s+(\d+):\s+"?([^"\s]+)"?\s+(.*)$/.exec(raw);
		if (!chip || !lineMatch) {
			continue;
		}
		const offset = Number(lineMatch[1]);
		const name = (lineMatch[2] ?? "").trim();
		const rest = (lineMatch[3] ?? "").toLowerCase();
		const dir: GpioDir | undefined = rest.includes("output")
			? "out"
			: rest.includes("input")
				? "in"
				: undefined;
		if (!Number.isInteger(offset)) {
			continue;
		}
		lines.push({
			chip,
			line: offset,
			name: !name || name === "unnamed" ? "" : name,
			dir,
		});
	}
	return lines;
}

export function parseWiringOpReadall(text: string): Map<number, string> {
	const names = new Map<number, string>();
	for (const raw of text.split("\n")) {
		if (!raw.includes("||")) {
			continue;
		}
		const [left, right] = raw.split("||");
		addReadallSide(names, left ?? "", "left");
		addReadallSide(names, right ?? "", "right");
	}
	return names;
}

export function resolveHeaderLines(
	hardware: HardwareId,
	gpioinfoText: string,
	readallText = "",
	model?: string,
): Map<number, GpioLineRef> {
	const sku = skuPinout(model);
	if (sku) {
		const chips = parseGpioChips(gpioinfoText);
		const resolved = new Map<number, GpioLineRef>();
		for (const pin of sku.lines) {
			resolved.set(pin.physical, {
				chip: resolveSkuChip(pin.domain, chips),
				line: pin.line,
				name: pin.soc ?? pin.name,
			});
		}
		return resolved;
	}
	const info = parseGpioinfo(gpioinfoText);
	const byName = new Map<string, GpioInfoLine>();
	for (const line of info) {
		if (!line.name) {
			continue;
		}
		byName.set(normalizeLineName(line.name), line);
	}
	const wiringNames = parseWiringOpReadall(readallText);
	const resolved = new Map<number, GpioLineRef>();
	for (const pin of headerPinsForBoard(hardware, model)) {
		if (pin.type !== "gpio") {
			continue;
		}
		const ref = resolvePinLine(
			hardware,
			pin.physical,
			pin,
			byName,
			wiringNames,
		);
		if (ref) {
			resolved.set(pin.physical, {
				chip: ref.chip,
				line: ref.line,
				name: ref.name,
			});
		}
	}
	return resolved;
}

export function createGpioController(
	backend: GpioBackend,
	options?: GpioControllerOptions,
): GpioController {
	function model(): string | undefined {
		if (typeof options?.model === "function") {
			return options.model();
		}
		return options?.model;
	}
	return {
		async snapshot(hardware) {
			return readSnapshot(hardware, backend, undefined, undefined, model());
		},
		async apply(hardware, put) {
			const board = model();
			const sku = skuPinout(board);
			const physical = put.physical;
			if (sku && physical > sku.pinCount) {
				throw new GpioError(`pin ${physical} is not on this header`);
			}
			const pin = assertGpioDrive(hardware, physical);
			const { gpioinfoText, readallText } = await probe(backend);
			const ref = resolveHeaderLines(
				hardware,
				gpioinfoText,
				readallText,
				board,
			).get(physical);
			if (!ref) {
				throw new GpioError(
					pin.resolve === "live"
						? `pin ${physical} is unresolved`
						: `pin ${physical} line not found`,
				);
			}
			if (isGpioTone(put)) {
				if (!backend.tone) {
					throw new GpioError("tone is unavailable");
				}
				await backend.tone(ref, put.hz);
			} else if (isGpioNoTone(put)) {
				if (backend.noTone) {
					await backend.noTone(ref);
				} else {
					await backend.set(ref, "in");
				}
			} else if (put.dir === "pwm") {
				if (!backend.analogWrite) {
					throw new GpioError("pwm is unavailable");
				}
				await backend.analogWrite(ref, put.analog ?? 0);
			} else {
				if (backend.noTone) {
					await backend.noTone(ref);
				}
				await backend.set(ref, put.dir, put.value);
			}
			return readSnapshot(hardware, backend, gpioinfoText, readallText, board);
		},
	};
}

export function createLibgpiodGpio(): GpioController {
	const held = new Map<
		string,
		{ proc: ReturnType<typeof Bun.spawn>; value: 0 | 1 }
	>();
	const pwmHeld = new Map<string, PwmHold>();
	return createGpioController(
		{
			gpioinfo: () => spawnText(["gpioinfo"]),
			readall: () => spawnText(["gpio", "readall"]).catch(() => ""),
			pwm: readSysfsPwm,
			async get(ref) {
				const pwm = pwmHeld.get(lineKey(ref));
				if (pwm) {
					return {
						dir: pwm.hz ? "out" : "pwm",
						value: pwm.analog >= 128 ? 1 : 0,
						analog: pwm.hz ? undefined : pwm.analog,
						hz: pwm.hz,
					};
				}
				const current = held.get(lineKey(ref));
				if (current) {
					return { dir: "out", value: current.value };
				}
				const text = await spawnGpioGet(ref);
				return parseGpioGet(text);
			},
			async set(ref, dir, value) {
				await releasePwm(pwmHeld, ref);
				await releaseHeld(held, ref);
				if (dir === "in") {
					await spawnGpioGet(ref, false);
					return;
				}
				if (value !== 0 && value !== 1) {
					throw new GpioError("value is required for output");
				}
				const proc = await spawnGpioHold(ref, value);
				if (proc) {
					held.set(lineKey(ref), { proc, value });
				}
			},
			async analogWrite(ref, analog) {
				await releaseHeld(held, ref);
				await startPwm(pwmHeld, ref, analog, undefined);
			},
			async tone(ref, hz) {
				await releaseHeld(held, ref);
				await startPwm(pwmHeld, ref, 128, hz);
			},
			async noTone(ref) {
				await releasePwm(pwmHeld, ref);
			},
		},
		{ model: () => readBoardModel() },
	);
}

export function memoryGpioBackend(
	infoText: string,
	readallText = "",
	values: Record<string, 0 | 1> = {},
	pwm: Record<number, number> = {},
): GpioBackend {
	const state = new Map<string, GpioLive>();
	for (const line of parseGpioinfo(infoText)) {
		const key = lineKey(line);
		state.set(key, { dir: line.dir ?? "in", value: values[key] ?? 0 });
	}
	return {
		async gpioinfo() {
			return infoText;
		},
		async readall() {
			return readallText;
		},
		async get(ref) {
			return state.get(lineKey(ref)) ?? { dir: "in", value: 0 };
		},
		async set(ref, dir, value) {
			state.set(lineKey(ref), {
				dir,
				value: dir === "out" ? (value ?? 0) : 0,
			});
		},
		async analogWrite(ref, analog) {
			state.set(lineKey(ref), {
				dir: "pwm",
				analog,
				value: analog >= 128 ? 1 : 0,
			});
		},
		async tone(ref, hz) {
			state.set(lineKey(ref), { dir: "out", hz, analog: 128, value: 1 });
		},
		async noTone(ref) {
			const current = state.get(lineKey(ref)) ?? { dir: "in", value: 0 };
			state.set(lineKey(ref), { dir: "in", value: current.value ?? 0 });
		},
		async pwm() {
			return new Map(
				Object.entries(pwm).map(([channel, percent]) => [
					Number(channel),
					percent,
				]),
			);
		},
	};
}

async function readSnapshot(
	hardware: HardwareId,
	backend: GpioBackend,
	gpioinfoText?: string,
	readallText?: string,
	model?: string,
): Promise<GpioSnapshot> {
	const infoText = gpioinfoText ?? (await backend.gpioinfo());
	const wiringText =
		readallText ?? (hardware === "orangepi" ? await backend.readall() : "");
	const pwmDuties = backend.pwm
		? await backend.pwm().catch(() => new Map<number, number>())
		: new Map<number, number>();
	const resolved = resolveHeaderLines(hardware, infoText, wiringText, model);
	const infoDirs = gpioinfoDirs(infoText);
	const pins: GpioPinState[] = [];
	for (const def of headerPinsForBoard(hardware, model)) {
		const reserved = GPIO_RESERVED_PHYSICAL[hardware].includes(def.physical);
		const ref = resolved.get(def.physical);
		if (def.type !== "gpio") {
			pins.push({
				physical: def.physical,
				name: def.name,
				type: def.type,
			});
			continue;
		}
		if (!ref) {
			const pin: GpioPinState = {
				physical: def.physical,
				name: def.name,
				type: "gpio",
				reserved,
				unresolved: !reserved,
			};
			if (def.alt?.length) {
				pin.alt = def.alt;
			}
			const pwm = pwmForPin(def, pwmDuties);
			if (pwm !== undefined) {
				pin.pwm = pwm;
			}
			pins.push(pin);
			continue;
		}
		let live: GpioLive | undefined;
		try {
			live = await backend.get(ref);
		} catch {
			live = undefined;
		}
		const infoDir = infoDirs.get(lineKey(ref));
		const pwm = pwmForPin(def, pwmDuties);
		const pin: GpioPinState = {
			physical: def.physical,
			name: def.name,
			type: "gpio",
			chip: ref.chip,
			line: ref.line,
			dir: live?.dir ?? infoDir,
			value: live?.value,
			reserved,
		};
		if (def.alt?.length) {
			pin.alt = def.alt;
		}
		if (live?.analog !== undefined) {
			pin.analog = live.analog;
			pin.pwm = analogToPwmPercent(live.analog);
			pin.dir = "pwm";
		} else if (pwm !== undefined) {
			pin.pwm = pwm;
		}
		if (live?.hz !== undefined) {
			pin.hz = live.hz;
			pin.dir = "out";
		}
		pins.push(pin);
	}
	return { hardware, pins };
}

async function probe(backend: GpioBackend): Promise<{
	gpioinfoText: string;
	readallText: string;
}> {
	return {
		gpioinfoText: await backend.gpioinfo(),
		readallText: await backend.readall().catch(() => ""),
	};
}

function resolvePinLine(
	hardware: HardwareId,
	physical: number,
	pin: { name: string; bcm?: number | null; resolve?: "live" },
	byName: Map<string, GpioInfoLine>,
	wiringNames: Map<number, string>,
): GpioLineRef | undefined {
	if (hardware === "raspberrypi" && pin.bcm != null) {
		const named = byName.get(normalizeLineName(gpioNamedLine(pin.bcm)));
		if (named) {
			return named;
		}
		const fallback = [...byName.values()].find(
			(line) => line.chip === "gpiochip0" && line.line === pin.bcm,
		);
		if (fallback) {
			return fallback;
		}
	}
	const wiring = wiringNames.get(physical);
	if (wiring) {
		const named = byName.get(normalizeLineName(wiring));
		if (named) {
			return named;
		}
	}
	if (pin.name !== "GPIO") {
		const exact = byName.get(normalizeLineName(pin.name));
		if (exact) {
			return exact;
		}
		for (const [name, line] of byName) {
			if (name.includes(normalizeLineName(pin.name))) {
				return line;
			}
		}
	}
	return undefined;
}

function addReadallSide(
	names: Map<number, string>,
	side: string,
	which: "left" | "right",
) {
	const fields = side.split("|").map((part) => part.trim());
	const cells = fields.filter((part) => part.length > 0);
	if (cells.length < 2) {
		return;
	}
	if (which === "left") {
		const physical = Number(cells[cells.length - 1]);
		const name = cells[2] ?? "";
		if (Number.isInteger(physical) && isGpioName(name)) {
			names.set(physical, name);
		}
		return;
	}
	const physical = Number(cells[0]);
	const name = cells[3] ?? cells[2] ?? "";
	if (Number.isInteger(physical) && isGpioName(name)) {
		names.set(physical, name);
	}
}

function isGpioName(name: string): boolean {
	const trimmed = name.trim();
	if (!trimmed) {
		return false;
	}
	const lower = trimmed.toLowerCase();
	return !(
		lower.includes("3.3") ||
		lower.includes("5v") ||
		lower === "0v" ||
		lower === "gnd"
	);
}

function normalizeLineName(name: string): string {
	return name.trim().toUpperCase().replace(/[.\s]/g, "");
}

function lineKey(ref: { chip: string; line: number }): string {
	return `${ref.chip}:${ref.line}`;
}

export function parseGpioGet(text: string): GpioLive {
	const trimmed = text.trim();
	if (/\binactive\b/i.test(trimmed)) {
		return { value: 0 };
	}
	if (/\bactive\b/i.test(trimmed)) {
		return { value: 1 };
	}
	const match = /\b([01])\b/.exec(trimmed);
	if (!match) {
		throw new GpioError("gpioget returned no value");
	}
	return { value: match[1] === "1" ? 1 : 0 };
}

type PwmHold = {
	proc: ReturnType<typeof Bun.spawn>;
	analog: number;
	hz?: number;
};

function gpioinfoDirs(text: string): Map<string, GpioDir> {
	const dirs = new Map<string, GpioDir>();
	for (const line of parseGpioinfo(text)) {
		if (line.dir) {
			dirs.set(lineKey(line), line.dir);
		}
	}
	return dirs;
}

function pwmForPin(
	def: HeaderPinDef,
	duties: Map<number, number>,
): number | undefined {
	const alts = def.alt ?? [];
	if (alts.includes("PWM0") && duties.has(0)) {
		return duties.get(0);
	}
	if (alts.includes("PWM1") && duties.has(1)) {
		return duties.get(1);
	}
	return undefined;
}

async function readSysfsPwm(): Promise<Map<number, number>> {
	const duties = new Map<number, number>();
	for (const chip of ["pwmchip0", "pwmchip1"]) {
		for (const channel of [0, 1]) {
			const percent = await readSysfsPwmChannel(chip, channel);
			if (percent !== undefined && !duties.has(channel)) {
				duties.set(channel, percent);
			}
		}
	}
	return duties;
}

async function readSysfsPwmChannel(
	chip: string,
	channel: number,
): Promise<number | undefined> {
	const base = `/sys/class/pwm/${chip}/pwm${channel}`;
	try {
		const [enableText, periodText, dutyText] = await Promise.all([
			Bun.file(`${base}/enable`).text(),
			Bun.file(`${base}/period`).text(),
			Bun.file(`${base}/duty_cycle`).text(),
		]);
		if (enableText.trim() !== "1") {
			return undefined;
		}
		const period = Number(periodText.trim());
		const duty = Number(dutyText.trim());
		if (!Number.isFinite(period) || period <= 0 || !Number.isFinite(duty)) {
			return undefined;
		}
		return Math.round((Math.min(duty, period) / period) * 1000) / 10;
	} catch {
		return undefined;
	}
}

async function releaseHeld(
	held: Map<string, { proc: ReturnType<typeof Bun.spawn>; value: 0 | 1 }>,
	ref: GpioLineRef,
): Promise<void> {
	const current = held.get(lineKey(ref));
	if (!current) {
		return;
	}
	held.delete(lineKey(ref));
	try {
		current.proc.kill();
	} catch {
		undefined;
	}
	await current.proc.exited.catch(() => undefined);
}

async function spawnGpioHold(
	ref: GpioLineRef,
	value: 0 | 1,
): Promise<ReturnType<typeof Bun.spawn> | undefined> {
	const signal = await spawnDetached([
		"gpioset",
		"-m",
		"signal",
		"-c",
		ref.chip,
		`${ref.line}=${value}`,
	]);
	if (signal) {
		return signal;
	}
	const waiting = await spawnDetached(
		["gpioset", "-c", ref.chip, `${ref.line}=${value}`],
		"pipe",
	);
	if (waiting) {
		return waiting;
	}
	try {
		await spawnGpioSet(ref, value);
	} catch (error) {
		if (!isUnknownCliOption(error)) {
			throw error;
		}
		await spawnText(["gpioset", ref.chip, `${ref.line}=${value}`]);
	}
	return undefined;
}

async function spawnDetached(
	cmd: string[],
	stdin: "ignore" | "pipe" = "ignore",
): Promise<ReturnType<typeof Bun.spawn> | undefined> {
	const proc = Bun.spawn(privileged(cmd), {
		stdout: "ignore",
		stderr: "pipe",
		stdin,
	});
	const exited = await Promise.race([
		proc.exited,
		Bun.sleep(80).then(() => null),
	]);
	if (exited === null) {
		return proc;
	}
	return undefined;
}

async function startPwm(
	held: Map<string, PwmHold>,
	ref: GpioLineRef,
	analog: number,
	hz?: number,
): Promise<void> {
	await releasePwm(held, ref);
	if (held.size >= GPIO_MAX_PWM) {
		throw new GpioError("too many pwm pins");
	}
	const bin = resolvePwmBin();
	if (!bin) {
		throw new GpioError("gpio-pwm helper is not installed");
	}
	const cmd = [
		bin,
		"--chip",
		ref.chip,
		"--line",
		String(ref.line),
		"--mode",
		hz ? "tone" : "pwm",
		"--duty",
		String(analog),
		"--hz",
		String(hz ?? GPIO_PWM_HZ),
	];
	const proc = Bun.spawn(privileged(cmd), {
		stdout: "ignore",
		stderr: "pipe",
		stdin: "pipe",
	});
	const exited = await Promise.race([
		proc.exited,
		Bun.sleep(80).then(() => null),
	]);
	if (exited !== null) {
		const stderr = await readPipe(proc.stderr);
		throw new GpioError(stderr.trim() || "gpio-pwm failed");
	}
	held.set(lineKey(ref), { proc, analog, hz });
}

async function releasePwm(
	held: Map<string, PwmHold>,
	ref: GpioLineRef,
): Promise<void> {
	const current = held.get(lineKey(ref));
	if (!current) {
		return;
	}
	held.delete(lineKey(ref));
	try {
		const stdin = current.proc.stdin;
		if (stdin && typeof stdin !== "number") {
			stdin.write("stop\n");
		}
	} catch {
		undefined;
	}
	try {
		current.proc.kill();
	} catch {
		undefined;
	}
	await current.proc.exited.catch(() => undefined);
}

function resolvePwmBin(): string | undefined {
	const env = process.env.GPIO_COMPANION_PWM?.trim();
	if (env && existsSync(env)) {
		return env;
	}
	const installed = "/usr/local/lib/gpio-companion/gpio-pwm";
	const source = new URL("../../../native/gpio-pwm/gpio-pwm", import.meta.url)
		.pathname;
	for (const path of [installed, source]) {
		if (existsSync(path)) {
			return path;
		}
	}
	return undefined;
}

async function spawnGpioGet(ref: GpioLineRef, asIs = true): Promise<string> {
	const extra = asIs ? ["-a"] : [];
	try {
		return await spawnText([
			"gpioget",
			...extra,
			"--numeric",
			"-c",
			ref.chip,
			String(ref.line),
		]);
	} catch (error) {
		if (!isUnknownCliOption(error)) {
			throw error;
		}
	}
	try {
		return await spawnText(["gpioget", "-c", ref.chip, String(ref.line)]);
	} catch (error) {
		if (!isUnknownCliOption(error)) {
			throw error;
		}
	}
	return spawnText(["gpioget", ref.chip, String(ref.line)]);
}

async function spawnGpioSet(ref: GpioLineRef, value: 0 | 1): Promise<void> {
	try {
		await spawnText(["gpioset", "-c", ref.chip, `${ref.line}=${value}`]);
	} catch (error) {
		if (!isUnknownCliOption(error)) {
			throw error;
		}
		await spawnText(["gpioset", ref.chip, `${ref.line}=${value}`]);
	}
}

function isUnknownCliOption(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /invalid option|unrecognized option|unknown option/i.test(message);
}

async function spawnText(cmd: string[]): Promise<string> {
	const proc = Bun.spawn(privileged(cmd), { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		readPipe(proc.stdout),
		readPipe(proc.stderr),
		proc.exited,
	]);
	if (code !== 0) {
		throw new GpioError(stderr.trim() || stdout.trim() || `${cmd[0]} failed`);
	}
	return stdout;
}

async function readPipe(
	stream: ReadableStream<Uint8Array> | number | undefined,
): Promise<string> {
	if (!stream || typeof stream === "number") {
		return "";
	}
	return new Response(stream).text();
}
