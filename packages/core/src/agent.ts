export const AGENT_PATH = "/v1/agent";
export const AGENT_STOP_PATH = "/v1/agent/stop";
export const AGENT_LOG_MAX = 16 * 1024;
export const AGENT_PROMPT_MAX = 8000;

export type AgentPut = {
	repo: string;
	prompt: string;
};

export type AgentResult = {
	ok: boolean;
	repo: string;
	log: string;
	startedAt: number;
	finishedAt: number;
};

export type AgentStatus = {
	running: boolean;
	log: string;
	last: AgentResult | null;
};

export class AgentError extends Error {
	readonly status: 400 | 409;

	constructor(message: string, status: 400 | 409 = 400) {
		super(message);
		this.name = "AgentError";
		this.status = status;
	}
}

export function isAgentPath(path: string): boolean {
	return path === AGENT_PATH || path === AGENT_STOP_PATH;
}

export function parseAgentPut(input: unknown): AgentPut {
	if (input === null || typeof input !== "object") {
		throw new AgentError("agent must be an object");
	}
	const record = input as Record<string, unknown>;
	return {
		repo: requiredRepo(record.repo),
		prompt: requiredPrompt(record.prompt),
	};
}

export function capAgentLog(log: string): string {
	if (log.length <= AGENT_LOG_MAX) {
		return log;
	}
	return log.slice(log.length - AGENT_LOG_MAX);
}

function requiredRepo(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new AgentError("repo is required");
	}
	const repo = value.trim();
	if (repo.includes("/") || repo.includes("\\") || repo.includes("..")) {
		throw new AgentError("repo is invalid");
	}
	return repo;
}

function requiredPrompt(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new AgentError("prompt is required");
	}
	const prompt = value.trim();
	if (prompt.length > AGENT_PROMPT_MAX) {
		throw new AgentError("prompt is too long");
	}
	return prompt;
}
