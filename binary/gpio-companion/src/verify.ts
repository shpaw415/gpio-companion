import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	BREADBOARD_DIAGRAM_JSON,
	type CircuitVerifyItem,
	type CircuitVerifyPut,
	type CircuitVerifyResult,
	type CircuitVerifyState,
	circuitVerifyPlan,
	type GpioSnapshot,
	parseVerifyPut,
	parseWokwiDiagram,
	VERIFY_PULSE_MS,
	VerifyError,
} from "gpio-companion";
import type { GpioController } from "./gpio.ts";
import { projectsRoot } from "./projects.ts";

export type VerifyController = {
	status(): CircuitVerifyState;
	start(input: unknown): { started: true };
	stop(): { stopped: true };
};

export type CircuitVerifyOptions = {
	hardware: () => GpioSnapshot["hardware"] | Promise<GpioSnapshot["hardware"]>;
	gpio: GpioController;
	projectsDir?: string;
	readDiagram?: (repo: string) => string;
	isRunBusy?: () => boolean;
	sleep?: (ms: number) => Promise<void>;
	onRunning?: (running: boolean) => void;
};

export function createCircuitVerify(
	options: CircuitVerifyOptions,
): VerifyController {
	let running = false;
	let aborted = false;
	let results: CircuitVerifyItem[] = [];
	let last: CircuitVerifyResult | null = null;
	return {
		status() {
			return { running, results, last };
		},
		start(input) {
			const put = parseVerifyPut(input);
			if (running) {
				throw new VerifyError("verify already running", 409);
			}
			if (options.isRunBusy?.()) {
				throw new VerifyError("run already running", 409);
			}
			running = true;
			aborted = false;
			results = [];
			options.onRunning?.(true);
			const startedAt = Date.now();
			void runVerify(put, options, () => aborted)
				.then((next) => {
					results = next.results;
					last = {
						...next,
						startedAt,
						finishedAt: Date.now(),
					};
				})
				.catch((caught) => {
					const detail =
						caught instanceof Error ? caught.message : "verify failed";
					results = [
						{
							id: "error",
							net: "",
							kind: "unsafe",
							status: "fail",
							partIds: [],
							pins: [],
							connections: [],
							detail,
						},
					];
					last = {
						ok: false,
						repo: put.repo,
						results,
						startedAt,
						finishedAt: Date.now(),
					};
				})
				.finally(() => {
					running = false;
					aborted = false;
					options.onRunning?.(false);
				});
			return { started: true };
		},
		stop() {
			aborted = true;
			return { stopped: true };
		},
	};
}

export function memoryVerify(
	options: Partial<CircuitVerifyOptions> & {
		gpio: GpioController;
		diagram?: string;
	},
): VerifyController {
	return createCircuitVerify({
		hardware: options.hardware ?? (() => "raspberrypi"),
		gpio: options.gpio,
		readDiagram: options.readDiagram ?? (() => options.diagram ?? ""),
		isRunBusy: options.isRunBusy,
		sleep: options.sleep ?? (async () => undefined),
	});
}

async function runVerify(
	put: CircuitVerifyPut,
	options: CircuitVerifyOptions,
	aborted: () => boolean,
): Promise<Omit<CircuitVerifyResult, "startedAt" | "finishedAt">> {
	const hardware = await options.hardware();
	if (options.gpio.releaseAll) {
		await options.gpio.releaseAll();
	}
	const text = options.readDiagram
		? options.readDiagram(put.repo)
		: readDiagram(options.projectsDir ?? projectsRoot(), put.repo);
	const diagram = parseWokwiDiagram(text);
	const snapshot = await options.gpio.snapshot(hardware);
	const plan = circuitVerifyPlan(diagram, snapshot);
	const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms));
	const results: CircuitVerifyItem[] = [];
	for (const item of plan) {
		if (aborted()) {
			break;
		}
		if (item.kind !== "continuity") {
			results.push(item);
			continue;
		}
		results.push(await probeContinuity(item, options.gpio, hardware, sleep));
	}
	return {
		ok: results.every(
			(item) => item.status !== "fail" && item.status !== "unsafe",
		),
		repo: put.repo,
		results,
	};
}

async function probeContinuity(
	item: CircuitVerifyItem,
	gpio: GpioController,
	hardware: GpioSnapshot["hardware"],
	sleep: (ms: number) => Promise<void>,
): Promise<CircuitVerifyItem> {
	const drive = item.pins[0];
	const sense = item.pins.slice(1);
	if (!drive || sense.length === 0) {
		return { ...item, status: "unknown", detail: "need two GPIOs" };
	}
	try {
		for (const physical of sense) {
			await gpio.apply(hardware, { physical, dir: "in" });
		}
		await gpio.apply(hardware, { physical: drive, dir: "out", value: 1 });
		await sleep(VERIFY_PULSE_MS);
		const high = await gpio.snapshot(hardware);
		await gpio.apply(hardware, { physical: drive, dir: "out", value: 0 });
		await sleep(VERIFY_PULSE_MS);
		const low = await gpio.snapshot(hardware);
		await gpio.apply(hardware, { physical: drive, dir: "in" });
		const highOk = sense.every(
			(physical) =>
				high.pins.find((pin) => pin.physical === physical)?.value === 1,
		);
		const lowOk = sense.every(
			(physical) =>
				low.pins.find((pin) => pin.physical === physical)?.value === 0,
		);
		if (highOk && lowOk) {
			return {
				...item,
				status: "pass",
				got: "sense followed drive",
				detail: `pins ${item.pins.join(", ")} are connected`,
			};
		}
		return {
			...item,
			status: "fail",
			got: highOk ? "high only" : lowOk ? "low only" : "open",
			detail: `pins ${item.pins.join(", ")} did not follow`,
		};
	} catch (caught) {
		try {
			await gpio.apply(hardware, { physical: drive, dir: "in" });
		} catch {
			undefined;
		}
		return {
			...item,
			status: "fail",
			detail: caught instanceof Error ? caught.message : "probe failed",
		};
	}
}

function readDiagram(root: string, repo: string): string {
	const path = join(root, repo, BREADBOARD_DIAGRAM_JSON);
	try {
		return readFileSync(path, "utf8");
	} catch {
		throw new VerifyError(`missing ${BREADBOARD_DIAGRAM_JSON} in ${repo}`, 404);
	}
}
