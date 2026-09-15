import { test } from "bun:test";
import { runCompanionLeakTest } from "./companion-emulator/run.ts";

test("emulated companion reaps children and does not leak", async () => {
	await runCompanionLeakTest();
}, 90_000);
