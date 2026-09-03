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
	modelRate,
	parseMarkup,
	tokensToMicrodollars,
	usdToMicros,
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
