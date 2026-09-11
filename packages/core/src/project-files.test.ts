import { describe, expect, test } from "bun:test";
import { BREADBOARD_DIAGRAM_JSON } from "./breadboard.ts";
import {
	githubCloneUrl,
	isProjectFileDir,
	PCB_CIRCUIT_JSON,
	PROJECT_FILE_DIRS,
	PROJECT_WATERMARK_BODY,
	PROJECT_WATERMARK_PATH,
	PROJECTS_SYNC_PATH,
	parseGithubRepoName,
	parseProjectSyncPut,
} from "./project-files.ts";

describe("project files", () => {
	test("layout dirs", () => {
		expect(PROJECT_FILE_DIRS).toEqual(["pcb", "breadboard", "technical"]);
		expect(isProjectFileDir("pcb")).toBe(true);
		expect(isProjectFileDir("src")).toBe(false);
		expect(PCB_CIRCUIT_JSON).toBe("pcb/circuit.json");
		expect(BREADBOARD_DIAGRAM_JSON).toBe("breadboard/diagram.json");
		expect(PROJECT_WATERMARK_PATH).toBe(".gpio-companion");
		expect(PROJECT_WATERMARK_BODY.trim()).toBe("gpio-companion");
		expect(PROJECTS_SYNC_PATH).toBe("/v1/projects/sync");
	});

	test("parses github repo names", () => {
		expect(parseGithubRepoName("blink-led")).toBe("blink-led");
		expect(parseGithubRepoName(" Blink.git ")).toBe("Blink");
		expect(() => parseGithubRepoName("has space")).toThrow();
		expect(() => parseGithubRepoName("../etc")).toThrow();
		expect(githubCloneUrl("ada", "blink")).toBe(
			"https://github.com/ada/blink.git",
		);
	});

	test("parses project sync bodies", () => {
		expect(parseProjectSyncPut(null)).toEqual({});
		expect(parseProjectSyncPut({})).toEqual({});
		expect(parseProjectSyncPut({ owner: "ada", name: "blink-led" })).toEqual({
			owner: "ada",
			name: "blink-led",
		});
		expect(() => parseProjectSyncPut({ owner: "ada" })).toThrow(
			"owner and name are required",
		);
		expect(() => parseProjectSyncPut([])).toThrow("body must be an object");
	});
});
