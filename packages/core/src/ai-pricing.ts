export const DEFAULT_AI_MODEL = "@cf/zai-org/glm-5.3";
export const DEFAULT_AI_MARKUP = 1.25;
export const USD_MICROS = 1_000_000;
export const LEGACY_CREDIT_MICROS = 10_000;
export const DEFAULT_MAX_COMPLETION_TOKENS = 4096;

export type TokenUsage = {
	prompt_tokens: number;
	completion_tokens: number;
	cached_tokens?: number;
};

export type ModelRate = {
	input: number;
	output: number;
	cachedInput?: number;
};

function usdPerM(usd: number): number {
	return Math.round(usd * USD_MICROS);
}

export const WORKERS_AI_LLM_RATES: Record<string, ModelRate> = {
	"@cf/meta/llama-3.2-1b-instruct": {
		input: usdPerM(0.027),
		output: usdPerM(0.201),
	},
	"@cf/meta/llama-3.2-3b-instruct": {
		input: usdPerM(0.051),
		output: usdPerM(0.335),
	},
	"@cf/meta/llama-3.1-8b-instruct-fp8-fast": {
		input: usdPerM(0.045),
		output: usdPerM(0.384),
	},
	"@cf/meta/llama-3.2-11b-vision-instruct": {
		input: usdPerM(0.049),
		output: usdPerM(0.676),
	},
	"@cf/meta/llama-3.1-70b-instruct-fp8-fast": {
		input: usdPerM(0.293),
		output: usdPerM(2.253),
	},
	"@cf/meta/llama-3.3-70b-instruct-fp8-fast": {
		input: usdPerM(0.293),
		output: usdPerM(2.253),
	},
	"@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": {
		input: usdPerM(0.497),
		output: usdPerM(4.881),
	},
	"@cf/deepseek-ai/deepseek-v4-flash-0731": {
		input: usdPerM(0.44),
		output: usdPerM(1.32),
		cachedInput: usdPerM(0.014),
	},
	"@cf/deepseek-ai/deepseek-v4-pro-0813": {
		input: usdPerM(1.32),
		output: usdPerM(3.96),
		cachedInput: usdPerM(0.044),
	},
	"@cf/mistral/mistral-7b-instruct-v0.1": {
		input: usdPerM(0.11),
		output: usdPerM(0.19),
	},
	"@cf/mistralai/mistral-small-3.1-24b-instruct": {
		input: usdPerM(0.351),
		output: usdPerM(0.555),
	},
	"@cf/meta/llama-3.1-8b-instruct": {
		input: usdPerM(0.282),
		output: usdPerM(0.827),
	},
	"@cf/meta/llama-3.1-8b-instruct-fp8": {
		input: usdPerM(0.152),
		output: usdPerM(0.287),
	},
	"@cf/meta/llama-3.1-8b-instruct-awq": {
		input: usdPerM(0.123),
		output: usdPerM(0.266),
	},
	"@cf/meta/llama-3-8b-instruct": {
		input: usdPerM(0.282),
		output: usdPerM(0.827),
	},
	"@cf/meta/llama-3-8b-instruct-awq": {
		input: usdPerM(0.123),
		output: usdPerM(0.266),
	},
	"@cf/meta/llama-2-7b-chat-fp16": {
		input: usdPerM(0.556),
		output: usdPerM(6.667),
	},
	"@cf/meta/llama-guard-3-8b": { input: usdPerM(0.484), output: usdPerM(0.03) },
	"@cf/meta/llama-4-scout-17b-16e-instruct": {
		input: usdPerM(0.27),
		output: usdPerM(0.85),
	},
	"@cf/google/gemma-3-12b-it": {
		input: usdPerM(0.345),
		output: usdPerM(0.556),
	},
	"@cf/qwen/qwq-32b": { input: usdPerM(0.66), output: usdPerM(1) },
	"@cf/qwen/qwen2.5-coder-32b-instruct": {
		input: usdPerM(0.66),
		output: usdPerM(1),
	},
	"@cf/qwen/qwen3-30b-a3b-fp8": {
		input: usdPerM(0.051),
		output: usdPerM(0.335),
	},
	"@cf/qwen/qwen3.8-27b": { input: usdPerM(0.45), output: usdPerM(3.2) },
	"@cf/openai/gpt-oss-120b": { input: usdPerM(0.35), output: usdPerM(0.75) },
	"@cf/openai/gpt-oss-20b": { input: usdPerM(0.2), output: usdPerM(0.3) },
	"@cf/aisingapore/gemma-sea-lion-v4-27b-it": {
		input: usdPerM(0.351),
		output: usdPerM(0.555),
	},
	"@cf/ibm-granite/granite-4.0-h-micro": {
		input: usdPerM(0.017),
		output: usdPerM(0.112),
	},
	"@cf/zai-org/glm-4.7-flash": { input: usdPerM(0.06), output: usdPerM(0.4) },
	"@cf/zai-org/glm-5.2": {
		input: usdPerM(1.4),
		output: usdPerM(4.4),
		cachedInput: usdPerM(0.26),
	},
	"@cf/zai-org/glm-5.3": {
		input: usdPerM(1.4),
		output: usdPerM(4.4),
		cachedInput: usdPerM(0.26),
	},
	"@cf/zai-org/glm-5.3-flash": {
		input: usdPerM(0.15),
		output: usdPerM(0.5),
		cachedInput: usdPerM(0.03),
	},
	"@cf/nvidia/nemotron-3-120b-a12b": {
		input: usdPerM(0.5),
		output: usdPerM(1.5),
	},
	"@cf/moonshotai/kimi-k2.5": {
		input: usdPerM(0.6),
		output: usdPerM(3),
		cachedInput: usdPerM(0.1),
	},
	"@cf/moonshotai/kimi-k2.6": {
		input: usdPerM(0.95),
		output: usdPerM(4),
		cachedInput: usdPerM(0.16),
	},
	"@cf/moonshotai/kimi-k2.7-code": {
		input: usdPerM(0.95),
		output: usdPerM(4),
		cachedInput: usdPerM(0.19),
	},
	"@cf/google/gemma-4-26b-a4b-it": {
		input: usdPerM(0.1),
		output: usdPerM(0.3),
	},
};

export function modelRate(model: string): ModelRate | null {
	return WORKERS_AI_LLM_RATES[model.trim()] ?? null;
}

export function parseMarkup(value: string | undefined): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_AI_MARKUP;
	}
	return parsed;
}

export function tokensToMicrodollars(
	rate: ModelRate,
	usage: TokenUsage,
): number {
	const prompt = Math.max(0, Math.floor(usage.prompt_tokens || 0));
	const completion = Math.max(0, Math.floor(usage.completion_tokens || 0));
	const cached = Math.min(
		prompt,
		Math.max(0, Math.floor(usage.cached_tokens || 0)),
	);
	const uncached = prompt - cached;
	const cachedRate = rate.cachedInput ?? rate.input;
	const raw =
		uncached * rate.input + cached * cachedRate + completion * rate.output;
	const micros = Math.ceil(raw / USD_MICROS);
	if (micros === 0 && prompt + completion > 0) {
		return 1;
	}
	return micros;
}

export function applyMarkup(micros: number, markup: number): number {
	const thousandths = Math.round(parseMarkup(String(markup)) * 1000);
	return Math.ceil((Math.max(0, micros) * thousandths) / 1000);
}

export function costMicrodollars(
	model: string,
	usage: TokenUsage,
	markup: number = DEFAULT_AI_MARKUP,
): number | null {
	const rate = modelRate(model);
	if (!rate) {
		return null;
	}
	return applyMarkup(tokensToMicrodollars(rate, usage), markup);
}

export function estimatePromptTokens(payload: unknown): number {
	const json = JSON.stringify(payload ?? "");
	return Math.max(1, Math.ceil(json.length / 4));
}

export function microsToUsd(micros: number): number {
	return Math.max(0, micros) / USD_MICROS;
}

export function usdToMicros(usd: number): number {
	return Math.max(0, Math.round(usd * USD_MICROS));
}

export function formatUsd(micros: number): string {
	return `$${microsToUsd(micros).toFixed(4)}`;
}
