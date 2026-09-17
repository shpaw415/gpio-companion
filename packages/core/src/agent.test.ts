import { describe, expect, test } from "bun:test";
import {
	AGENT_LOG_MAX,
	AgentError,
	capAgentLog,
	isAgentPath,
	parseAgentPut,
} from "./agent.ts";

describe("parseAgentPut", () => {
	test("requires repo and prompt", () => {
		expect(parseAgentPut({ repo: "blink-led", prompt: "add a blink" })).toEqual(
			{
				repo: "blink-led",
				prompt: "add a blink",
			},
		);
	});

	test("rejects path-like repo", () => {
		expect(() => parseAgentPut({ repo: "../etc", prompt: "x" })).toThrow(
			AgentError,
		);
		expect(() => parseAgentPut({ repo: "a/b", prompt: "x" })).toThrow(
			"invalid",
		);
	});

	test("rejects empty prompt", () => {
		expect(() => parseAgentPut({ repo: "blink-led" })).toThrow("prompt");
	});
});

describe("agent helpers", () => {
	test("path match", () => {
		expect(isAgentPath("/v1/agent")).toBe(true);
		expect(isAgentPath("/v1/agent/stop")).toBe(true);
		expect(isAgentPath("/v1/run")).toBe(false);
	});

	test("caps log", () => {
		expect(capAgentLog("ok")).toBe("ok");
		const log = "x".repeat(AGENT_LOG_MAX + 10);
		expect(capAgentLog(log).length).toBe(AGENT_LOG_MAX);
	});
});
