export const RUN_PATH = "/v1/run";
export const RUN_STOP_PATH = "/v1/run/stop";
export const RUN_LOG_MAX = 16 * 1024;

export type RunPut = {
	dir: string;
};

export type RunResult = {
	ok: boolean;
	dir: string;
	log: string;
	startedAt: number;
	finishedAt: number;
};

export type RunStatus = {
	running: boolean;
	log: string;
	last: RunResult | null;
};

export class RunError extends Error {
	readonly status: 400 | 409;

	constructor(message: string, status: 400 | 409 = 400) {
		super(message);
		this.name = "RunError";
		this.status = status;
	}
}

export function isRunPath(path: string): boolean {
	return path === RUN_PATH || path === RUN_STOP_PATH;
}

export function parseRunPut(input: unknown): RunPut {
	if (input === null || typeof input !== "object") {
		throw new RunError("run must be an object");
	}
	const record = input as Record<string, unknown>;
	return { dir: requiredDir(record.dir) };
}

export function capRunLog(log: string): string {
	if (log.length <= RUN_LOG_MAX) {
		return log;
	}
	return log.slice(log.length - RUN_LOG_MAX);
}

function requiredDir(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new RunError("dir is required");
	}
	const dir = value.trim();
	if (!dir.startsWith("/") || dir.includes("..")) {
		throw new RunError("dir must be an absolute path");
	}
	return dir;
}
