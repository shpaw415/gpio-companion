import { describe, expect, test } from "bun:test";
import { BREADBOARD_DIAGRAM_JSON } from "./breadboard.ts";
import {
	isProjectFileDir,
	PCB_CIRCUIT_JSON,
	PROJECT_FILE_DIRS,
} from "./project-files.ts";

describe("project files", () => {
	test("layout dirs", () => {
		expect(PROJECT_FILE_DIRS).toEqual(["pcb", "breadboard", "technical"]);
		expect(isProjectFileDir("pcb")).toBe(true);
		expect(isProjectFileDir("src")).toBe(false);
		expect(PCB_CIRCUIT_JSON).toBe("pcb/circuit.json");
		expect(BREADBOARD_DIAGRAM_JSON).toBe("breadboard/diagram.json");
	});
});
