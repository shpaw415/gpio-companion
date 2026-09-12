export const FLASH_PATH = "/v1/flash";
export const FLASH_PORTS_PATH = "/v1/flash/ports";
export const FLASH_SKETCHES_PATH = "/v1/flash/sketches";
export const FLASH_LOG_MAX = 16 * 1024;

export type FlashPort = {
	address: string;
	protocol?: string;
	fqbn?: string;
	name?: string;
};

export type FlashPut = {
	fqbn: string;
	dir: string;
	port?: string;
};

export type FlashResult = {
	ok: boolean;
	fqbn: string;
	dir: string;
	port?: string;
	log: string;
	startedAt: number;
	finishedAt: number;
};

export type FlashStatus = {
	running: boolean;
	last: FlashResult | null;
};

export class FlashError extends Error {
	readonly status: 400 | 409;

	constructor(message: string, status: 400 | 409 = 400) {
		super(message);
		this.name = "FlashError";
		this.status = status;
	}
}

export function isFlashPath(path: string): boolean {
	return (
		path === FLASH_PATH ||
		path === FLASH_PORTS_PATH ||
		path === FLASH_SKETCHES_PATH
	);
}

export function parseFlashPut(input: unknown): FlashPut {
	if (input === null || typeof input !== "object") {
		throw new FlashError("flash must be an object");
	}
	const record = input as Record<string, unknown>;
	const fqbn = requiredToken(record.fqbn, "fqbn");
	const dir = requiredDir(record.dir);
	const put: FlashPut = { fqbn, dir };
	if (record.port !== undefined && record.port !== "") {
		put.port = requiredToken(record.port, "port");
	}
	return put;
}

export function capFlashLog(log: string): string {
	if (log.length <= FLASH_LOG_MAX) {
		return log;
	}
	return log.slice(log.length - FLASH_LOG_MAX);
}

export function parseArduinoBoardList(input: unknown): FlashPort[] {
	let parsed = input;
	if (typeof input === "string") {
		try {
			parsed = JSON.parse(input) as unknown;
		} catch {
			return [];
		}
	}
	const detected = portsArray(parsed);
	const ports: FlashPort[] = [];
	for (const item of detected) {
		if (!item || typeof item !== "object") {
			continue;
		}
		const row = item as Record<string, unknown>;
		const port =
			row.port && typeof row.port === "object"
				? (row.port as Record<string, unknown>)
				: row;
		const address = stringField(port.address) || stringField(port.label);
		if (!address) {
			continue;
		}
		const boards = Array.isArray(row.matching_boards)
			? row.matching_boards
			: [];
		const board =
			boards[0] && typeof boards[0] === "object"
				? (boards[0] as Record<string, unknown>)
				: {};
		ports.push({
			address,
			protocol: stringField(port.protocol) || undefined,
			fqbn: stringField(board.fqbn) || undefined,
			name: stringField(board.name) || undefined,
		});
	}
	return ports;
}

function portsArray(parsed: unknown): unknown[] {
	if (Array.isArray(parsed)) {
		return parsed;
	}
	if (parsed && typeof parsed === "object") {
		const record = parsed as Record<string, unknown>;
		if (Array.isArray(record.detected_ports)) {
			return record.detected_ports;
		}
		if (Array.isArray(record.ports)) {
			return record.ports;
		}
	}
	return [];
}

function requiredToken(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new FlashError(`${field} is required`);
	}
	const trimmed = value.trim();
	if (!/^[A-Za-z0-9/._:-]+$/.test(trimmed)) {
		throw new FlashError(`${field} is invalid`);
	}
	return trimmed;
}

function requiredDir(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new FlashError("dir is required");
	}
	const dir = value.trim();
	if (!dir.startsWith("/") || dir.includes("..")) {
		throw new FlashError("dir must be an absolute path");
	}
	return dir;
}

function stringField(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}
