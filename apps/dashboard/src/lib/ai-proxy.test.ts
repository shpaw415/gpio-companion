import { describe, expect, test } from "bun:test";
import {
	billedMicros,
	buildAiInput,
	estimateUsage,
	extractUsage,
	parseSseUsage,
	resolveModel,
	toChatCompletion,
} from "./ai-proxy.ts";

describe("ai proxy", () => {
	test("defaults to glm-5.3", () => {
		expect(resolveModel({})).toBe("@cf/zai-org/glm-5.3");
	});

	test("forwards tools", () => {
		const input = buildAiInput(
			{
				messages: [{ role: "user", content: "hi" }],
				tools: [{ type: "function", function: { name: "bash" } }],
				tool_choice: "auto",
			},
			false,
		);
		expect(input.tools).toEqual([
			{ type: "function", function: { name: "bash" } },
		]);
		expect(input.stream).toBeUndefined();
	});

	test("maps legacy tool_calls", () => {
		const completion = toChatCompletion("@cf/zai-org/glm-5.3", {
			response: "",
			tool_calls: [{ name: "bash", arguments: { command: "ls" } }],
			usage: { prompt_tokens: 10, completion_tokens: 4 },
		});
		const choice = (completion.choices as Array<{ finish_reason: string }>)[0];
		expect(choice?.finish_reason).toBe("tool_calls");
	});

	test("extracts cached usage", () => {
		expect(
			extractUsage({
				usage: {
					prompt_tokens: 100,
					completion_tokens: 9,
					prompt_tokens_details: { cached_tokens: 40 },
				},
			}),
		).toEqual({
			prompt_tokens: 100,
			completion_tokens: 9,
			cached_tokens: 40,
		});
	});

	test("parses sse usage", () => {
		expect(
			parseSseUsage(
				`data: {"choices":[{"delta":{"content":"a"}}]}\ndata: {"usage":{"prompt_tokens":3,"completion_tokens":2}}\n`,
				null,
			),
		).toEqual({ prompt_tokens: 3, completion_tokens: 2, cached_tokens: 0 });
	});

	test("bills unknown model as null", () => {
		expect(
			billedMicros("nope", { prompt_tokens: 1, completion_tokens: 1 }, 1.25),
		).toBeNull();
	});

	test("estimateUsage is positive", () => {
		expect(
			estimateUsage({ messages: [{ role: "user", content: "hello world" }] })
				.prompt_tokens,
		).toBeGreaterThan(0);
	});

	test("forwards reasoning_effort", () => {
		expect(
			buildAiInput(
				{
					messages: [{ role: "user", content: "hi" }],
					reasoning_effort: "high",
				},
				false,
			).reasoning_effort,
		).toBe("high");
	});

	test("accepts OpenCode reasoningEffort camelCase", () => {
		expect(
			buildAiInput(
				{
					messages: [{ role: "user", content: "hi" }],
					reasoningEffort: "low",
				},
				false,
			).reasoning_effort,
		).toBe("low");
	});

	test("drops invalid reasoning effort", () => {
		expect(
			buildAiInput(
				{
					messages: [{ role: "user", content: "hi" }],
					reasoning_effort: "nope" as never,
				},
				false,
			).reasoning_effort,
		).toBeUndefined();
	});
});
