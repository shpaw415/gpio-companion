import {
	BREADBOARD_LEFT_COLS,
	GPIO_ARDUINO_PROXY_TYPE,
	GPIO_COMPANION_HEADER_TYPE,
	isBreadboardType,
	parseWokwiDiagram,
	splitEndpoint,
	type WokwiDiagram,
} from "./breadboard.ts";
import { arduinoProxyResolvePad } from "./breadboard-arduino.ts";
import {
	canDriveGpio,
	type GpioPinState,
	type GpioSnapshot,
	type GpioTarget,
} from "./gpio.ts";
import { parseGithubRepoName } from "./project-files.ts";

export const VERIFY_PATH = "/v1/verify";
export const VERIFY_STOP_PATH = "/v1/verify/stop";
export const VERIFY_PULSE_MS = 30;

export type CircuitVerifyKind =
	| "continuity"
	| "drive"
	| "button"
	| "power"
	| "unsafe";

export type CircuitVerifyStatus =
	| "pass"
	| "fail"
	| "unknown"
	| "needs-press"
	| "unsafe";

export type CircuitNet = {
	id: string;
	partIds: string[];
	pins: number[];
	arduinoPins: number[];
	arduinoKinds: Array<"3v3" | "5v" | "gnd">;
	connections: number[];
};

export type CircuitVerifyItem = {
	id: string;
	net: string;
	kind: CircuitVerifyKind;
	status: CircuitVerifyStatus;
	partIds: string[];
	pins: number[];
	arduinoPins?: number[];
	target?: GpioTarget;
	connections: number[];
	expect?: string;
	got?: string;
	detail: string;
};

export type CircuitVerifyPut = {
	repo: string;
};

export type CircuitVerifyResult = {
	ok: boolean;
	repo: string;
	results: CircuitVerifyItem[];
	startedAt: number;
	finishedAt: number;
};

export type CircuitVerifyState = {
	running: boolean;
	results: CircuitVerifyItem[];
	last: CircuitVerifyResult | null;
};

export type CircuitVerifyOverlay = {
	parts: Record<string, CircuitVerifyStatus>;
	wires: Record<string, CircuitVerifyStatus>;
};

export class VerifyError extends Error {
	readonly status: 400 | 404 | 409;

	constructor(message: string, status: 400 | 404 | 409 = 400) {
		super(message);
		this.name = "VerifyError";
		this.status = status;
	}
}

export function isVerifyPath(path: string): boolean {
	return path === VERIFY_PATH || path === VERIFY_STOP_PATH;
}

export function parseVerifyPut(input: unknown): CircuitVerifyPut {
	if (input === null || typeof input !== "object") {
		throw new VerifyError("verify must be an object");
	}
	const record = input as Record<string, unknown>;
	if (typeof record.repo !== "string" || !record.repo.trim()) {
		throw new VerifyError("repo is required");
	}
	try {
		return { repo: parseGithubRepoName(record.repo) };
	} catch (error) {
		throw new VerifyError(
			error instanceof Error ? error.message : "repo is invalid",
		);
	}
}

export function expandCircuitNets(diagram: WokwiDiagram): CircuitNet[] {
	const dsu = new Dsu();
	const boards = new Map(
		diagram.parts
			.filter((part) => isBreadboardType(part.type))
			.map((part) => [part.id, part.type] as const),
	);
	const headerIds = new Set(
		diagram.parts
			.filter((part) => part.type === GPIO_COMPANION_HEADER_TYPE)
			.map((part) => part.id),
	);
	const arduinoParts = new Map(
		diagram.parts
			.filter((part) => part.type === GPIO_ARDUINO_PROXY_TYPE)
			.map((part) => [part.id, part.attrs?.board] as const),
	);
	const connectionKeys: string[][] = [];
	for (const [index, connection] of diagram.connections.entries()) {
		const [from, to] = connection;
		const start = endpointKey(from, boards);
		const end = endpointKey(to, boards);
		dsu.union(start.endpoint, end.endpoint);
		if (start.strip) {
			dsu.union(start.endpoint, start.strip);
		}
		if (end.strip) {
			dsu.union(end.endpoint, end.strip);
		}
		connectionKeys[index] = [start.endpoint, end.endpoint];
	}
	const groups = new Map<string, CircuitNet>();
	for (const [index, keys] of connectionKeys.entries()) {
		for (const key of keys) {
			const root = dsu.find(key);
			const net = groups.get(root) ?? {
				id: root,
				partIds: [],
				pins: [],
				arduinoPins: [],
				arduinoKinds: [],
				connections: [],
			};
			if (!net.connections.includes(index)) {
				net.connections.push(index);
			}
			groups.set(root, net);
		}
	}
	for (const net of groups.values()) {
		const partIds = new Set<string>();
		const pins = new Set<number>();
		const arduinoPins = new Set<number>();
		const arduinoKinds = new Set<"3v3" | "5v" | "gnd">();
		for (const index of net.connections) {
			const connection = diagram.connections[index];
			if (!connection) {
				continue;
			}
			for (const endpoint of [connection[0], connection[1]]) {
				const { partId, pin } = splitEndpoint(endpoint);
				if (headerIds.has(partId)) {
					const physical = Number(pin);
					if (Number.isInteger(physical) && physical > 0) {
						pins.add(physical);
					}
				} else if (arduinoParts.has(partId)) {
					const pad = arduinoProxyResolvePad(arduinoParts.get(partId), pin);
					if (pad?.kind === "gpio" && typeof pad.physical === "number") {
						arduinoPins.add(pad.physical);
					} else if (pad?.kind === "gnd") {
						arduinoKinds.add("gnd");
					} else if (pad?.kind === "power") {
						arduinoKinds.add(/5v|vin/i.test(pad.name) ? "5v" : "3v3");
					}
				} else if (!boards.has(partId)) {
					partIds.add(partId);
				}
			}
		}
		net.partIds = [...partIds].sort();
		net.pins = [...pins].sort((a, b) => a - b);
		net.arduinoPins = [...arduinoPins].sort((a, b) => a - b);
		net.arduinoKinds = [...arduinoKinds];
	}
	return [...groups.values()].filter(
		(net) =>
			net.pins.length > 0 ||
			net.arduinoPins.length > 0 ||
			net.partIds.length > 0,
	);
}

export function circuitVerifyPlan(
	diagram: unknown,
	snapshot: GpioSnapshot,
	proxySnapshot?: GpioSnapshot | null,
): CircuitVerifyItem[] {
	const parsed = parseWokwiDiagram(diagram);
	const parts = new Map(parsed.parts.map((part) => [part.id, part]));
	const items: CircuitVerifyItem[] = [];
	for (const net of expandCircuitNets(parsed)) {
		const header = net.pins.map((physical) =>
			snapshot.pins.find((pin) => pin.physical === physical),
		);
		const arduino = net.arduinoPins.map((physical) => {
			const found = proxySnapshot?.pins.find(
				(pin) => pin.physical === physical,
			);
			return (
				found ?? {
					physical,
					name: `D${physical}`,
					type: "gpio" as const,
				}
			);
		});
		const headerDriveable = header.filter(
			(pin): pin is GpioPinState => pin !== undefined && canDriveGpio(pin),
		);
		const arduinoDriveable = arduino.filter((pin) => canDriveGpio(pin));
		const kinds = new Set(
			[
				...header.map((pin) => (pin ? powerKind(pin) : null)),
				...net.arduinoKinds,
			].filter((value): value is "3v3" | "5v" | "gnd" => Boolean(value)),
		);
		const hasButton = net.partIds.some(
			(id) => parts.get(id)?.type === "wokwi-pushbutton",
		);
		const id = `net-${net.pins.join("-") || net.arduinoPins.join("-") || net.partIds.join("-") || net.id}`;
		if (headerDriveable.length > 0 && arduinoDriveable.length > 0) {
			items.push(
				item(
					id,
					net,
					"unsafe",
					"unsafe",
					"GPIO net mixes companion header and Arduino — not driven",
				),
			);
			continue;
		}
		const driveable =
			arduinoDriveable.length > 0 ? arduinoDriveable : headerDriveable;
		const target: GpioTarget | undefined =
			arduinoDriveable.length > 0 ? "arduino-proxy" : undefined;
		if (kinds.has("3v3") && kinds.has("5v")) {
			items.push(
				item(id, net, "unsafe", "unsafe", "net mixes 3V3 and 5V — not driven"),
			);
			continue;
		}
		if (driveable.length > 0 && (kinds.has("3v3") || kinds.has("5v"))) {
			items.push(
				item(
					id,
					net,
					"unsafe",
					"unsafe",
					"GPIO shares a net with power — not driven",
				),
			);
			continue;
		}
		if (driveable.length > 0 && kinds.has("gnd") && !hasButton) {
			items.push(
				item(
					id,
					net,
					"unsafe",
					"unsafe",
					"GPIO shares a net with GND — not driven",
				),
			);
			continue;
		}
		if (hasButton) {
			items.push(
				item(
					id,
					net,
					"button",
					"needs-press",
					"press the button to test this net",
				),
			);
			continue;
		}
		if (driveable.length >= 2 && kinds.size === 0) {
			items.push({
				...item(
					id,
					net,
					"continuity",
					"unknown",
					"pulse one GPIO and read the others",
				),
				expect: "sense pins follow drive",
				pins: driveable.map((pin) => pin.physical),
				target,
			});
			continue;
		}
		if (driveable.length === 1 && kinds.size === 0) {
			items.push({
				...item(
					id,
					net,
					"drive",
					"unknown",
					"no second GPIO to sense; LED on/off is not electrically visible",
				),
				target,
			});
			continue;
		}
		if (kinds.size > 0) {
			items.push(
				item(id, net, "power", "unknown", "power or ground net — not probed"),
			);
		}
	}
	return items;
}

export function circuitVerifyOverlay(
	diagram: WokwiDiagram,
	results: CircuitVerifyItem[],
): CircuitVerifyOverlay {
	const parts: Record<string, CircuitVerifyStatus> = {};
	const wires: Record<string, CircuitVerifyStatus> = {};
	for (const result of results) {
		for (const partId of result.partIds) {
			parts[partId] = worseStatus(parts[partId], result.status);
		}
		for (const index of result.connections) {
			const connection = diagram.connections[index];
			if (!connection) {
				continue;
			}
			const key = `${connection[0]}->${connection[1]}`;
			wires[key] = worseStatus(wires[key], result.status);
		}
	}
	return { parts, wires };
}

export function circuitVerifyColor(
	status: CircuitVerifyStatus | undefined,
): string | undefined {
	if (status === "pass") {
		return "#22c55e";
	}
	if (status === "fail" || status === "unsafe") {
		return "#ef4444";
	}
	if (status === "needs-press") {
		return "#f59e0b";
	}
	return undefined;
}

export function circuitVerifyLabel(status: CircuitVerifyStatus): string {
	if (status === "pass") {
		return "Pass";
	}
	if (status === "fail") {
		return "Fail";
	}
	if (status === "needs-press") {
		return "Press";
	}
	if (status === "unsafe") {
		return "Unsafe";
	}
	return "Unknown";
}

function item(
	id: string,
	net: CircuitNet,
	kind: CircuitVerifyKind,
	status: CircuitVerifyStatus,
	detail: string,
): CircuitVerifyItem {
	return {
		id,
		net: net.id,
		kind,
		status,
		partIds: net.partIds,
		pins: net.pins,
		arduinoPins: net.arduinoPins,
		connections: net.connections,
		detail,
	};
}

function powerKind(pin: {
	type: string;
	name: string;
}): "3v3" | "5v" | "gnd" | null {
	if (pin.type === "gnd") {
		return "gnd";
	}
	if (pin.type !== "power") {
		return null;
	}
	return /5v/i.test(pin.name) ? "5v" : "3v3";
}

function worseStatus(
	current: CircuitVerifyStatus | undefined,
	next: CircuitVerifyStatus,
): CircuitVerifyStatus {
	const rank: Record<CircuitVerifyStatus, number> = {
		pass: 0,
		unknown: 1,
		"needs-press": 2,
		fail: 3,
		unsafe: 4,
	};
	if (!current || rank[next] > rank[current]) {
		return next;
	}
	return current;
}

function endpointKey(
	value: string,
	boards: Map<string, string>,
): { endpoint: string; strip: string | null } {
	const { partId, pin } = splitEndpoint(value);
	const endpoint = `${partId}:${pin}`;
	const type = boards.get(partId);
	if (!type) {
		return { endpoint, strip: null };
	}
	const hole = /^(\d+)([a-j])$/i.exec(pin);
	if (hole) {
		const col = hole[2]?.toLowerCase() ?? "";
		const side = (BREADBOARD_LEFT_COLS as readonly string[]).includes(col)
			? "left"
			: "right";
		return { endpoint, strip: `${partId}#row:${hole[1]}:${side}` };
	}
	const rail = /^([tb])([pn])\.\d+$/i.exec(pin);
	if (rail) {
		return {
			endpoint,
			strip: `${partId}#rail:${(rail[1] ?? "").toLowerCase()}${(rail[2] ?? "").toLowerCase()}`,
		};
	}
	return { endpoint, strip: null };
}

class Dsu {
	private readonly parent = new Map<string, string>();

	find(key: string): string {
		const parent = this.parent.get(key) ?? key;
		if (!this.parent.has(key)) {
			this.parent.set(key, key);
			return key;
		}
		if (parent === key) {
			return key;
		}
		const root = this.find(parent);
		this.parent.set(key, root);
		return root;
	}

	union(a: string, b: string): void {
		const left = this.find(a);
		const right = this.find(b);
		if (left !== right) {
			this.parent.set(left, right);
		}
	}
}
