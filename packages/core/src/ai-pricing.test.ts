import { describe, expect, test } from "bun:test";
import {
	applyMarkup,
	costMicrodollars,
	DEFAULT_AI_MARKUP,
	DEFAULT_AI_MODEL,
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
