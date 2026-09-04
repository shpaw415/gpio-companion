import { describe, expect, test } from "bun:test";
import {
	applyMarkup,
	costMicrodollars,
	DEFAULT_AI_MARKUP,
	DEFAULT_AI_MODEL,
	DEFAULT_EMBEDDING_MODEL,
	embeddingCostMicrodollars,
	embeddingModelInfo,
	estimateEmbeddingTokens,
	estimatePromptTokens,
	llmModelDisplayName,
	modelRate,
	openaiChatModelList,
	opencodeProviderModels,
	parseMarkup,
	tokensToMicrodollars,
	usdToMicros,
	WORKERS_AI_EMBEDDING_RATES,
	WORKERS_AI_LLM_RATES,
} from "./ai-pricing.ts";

describe("ai pricing", () => {
	test("prices glm-5.3", () => {
		expect(modelRate(DEFAULT_AI_MODEL)).toEqual({
			input: 1_400_000,
			output: 4_400_000,
			cachedInput: 260_000,
		});
	});

	test("bills glm-5.3 in/out at 1.25x", () => {
		expect(
			costMicrodollars(
				DEFAULT_AI_MODEL,
				{ prompt_tokens: 10_000, completion_tokens: 1_000 },
				1.25,
			),
		).toBe(23_000);
	});

	test("uses cached input rate", () => {
		expect(
			costMicrodollars(
				DEFAULT_AI_MODEL,
				{
					prompt_tokens: 10_000,
					completion_tokens: 1_000,
					cached_tokens: 5_000,
				},
				1.25,
			),
		).toBe(15_875);
	});

	test("rejects unknown models", () => {
		expect(
			costMicrodollars("@cf/unknown", {
				prompt_tokens: 10,
				completion_tokens: 10,
			}),
		).toBeNull();
	});

	test("parseMarkup falls back to 1.25", () => {
		expect(parseMarkup(undefined)).toBe(DEFAULT_AI_MARKUP);
		expect(parseMarkup("0")).toBe(DEFAULT_AI_MARKUP);
		expect(parseMarkup("1.25")).toBe(1.25);
		expect(parseMarkup("2")).toBe(2);
	});

	test("applyMarkup ceils", () => {
		expect(applyMarkup(1, 1.25)).toBe(2);
		expect(applyMarkup(8, 1.25)).toBe(10);
	});

	test("tokensToMicrodollars ceils fractional micros", () => {
		const rate = modelRate("@cf/ibm-granite/granite-4.0-h-micro");
		expect(rate).not.toBeNull();
		expect(
			tokensToMicrodollars(rate as NonNullable<typeof rate>, {
				prompt_tokens: 1,
				completion_tokens: 0,
			}),
		).toBe(1);
	});

	test("estimatePromptTokens is length/4", () => {
		expect(estimatePromptTokens({ a: "abcd" })).toBeGreaterThan(0);
	});

	test("usdToMicros", () => {
		expect(usdToMicros(1)).toBe(1_000_000);
	});
});

describe("opencode provider models", () => {
	test("lists every priced LLM", () => {
		expect(Object.keys(opencodeProviderModels()).sort()).toEqual(
			Object.keys(WORKERS_AI_LLM_RATES).sort(),
		);
	});

	test("names glm-5.3 GLM-5.3", () => {
		expect(llmModelDisplayName(DEFAULT_AI_MODEL)).toBe("GLM-5.3");
	});

	test("exposes thinking-effort variants on reasoning models", () => {
		const glm = opencodeProviderModels()[DEFAULT_AI_MODEL];
		expect(glm?.reasoning).toBe(true);
		expect(glm?.variants).toEqual({
			low: { reasoningEffort: "low" },
			medium: { reasoningEffort: "medium" },
			high: { reasoningEffort: "high" },
		});
	});

	test("omits variants on non-reasoning models", () => {
		const llama = opencodeProviderModels()["@cf/meta/llama-3.2-1b-instruct"];
		expect(llama?.reasoning).toBeUndefined();
		expect(llama?.variants).toBeUndefined();
	});

	test("openai list matches priced LLMs and excludes embeddings", () => {
		const ids = openaiChatModelList().map((item) => item.id);
		expect(ids).toContain(DEFAULT_AI_MODEL);
		expect(ids).toContain("@cf/moonshotai/kimi-k2.7-code");
		expect(ids).not.toContain(Object.keys(WORKERS_AI_EMBEDDING_RATES)[0]);
		expect(ids.sort()).toEqual(Object.keys(WORKERS_AI_LLM_RATES).sort());
	});
});

describe("embedding pricing", () => {
	test("default embedding model is bge-base at 768 dims", () => {
		const info = embeddingModelInfo(DEFAULT_EMBEDDING_MODEL);
		expect(info).not.toBeNull();
		expect((info as NonNullable<typeof info>).dimension).toBe(768);
	});

	test("bills bge-base per M input tokens at 1.25x", () => {
		// $0.067 per M input tokens => 1M tokens = $0.067 = 67000 micros, x1.25 = 83750
		expect(
			embeddingCostMicrodollars(DEFAULT_EMBEDDING_MODEL, 1_000_000, 1.25),
		).toBe(83_750);
	});

	test("minimum bill survives markup", () => {
		expect(embeddingCostMicrodollars(DEFAULT_EMBEDDING_MODEL, 1, 1.25)).toBe(2);
	});

	test("rejects unknown embedding models", () => {
		expect(
			embeddingCostMicrodollars("@cf/unknown-embedding", 1_000, 1.25),
		).toBeNull();
	});

	test("estimateEmbeddingTokens is length/4 per string", () => {
		expect(estimateEmbeddingTokens("abcdabcd")).toBe(2);
		expect(estimateEmbeddingTokens(["abcd", "abcdefgh"])).toBe(3);
		expect(estimateEmbeddingTokens(["a", 5, null])).toBe(1);
		expect(estimateEmbeddingTokens([])).toBe(0);
		expect(estimateEmbeddingTokens(42)).toBe(1);
	});
});
