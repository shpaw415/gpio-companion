import { census, leftoverLabels } from "./census.ts";
import { runScenarios } from "./scenarios.ts";
import { startCompanion } from "./start.ts";

const RSS_GROWTH_KB = 15 * 1024;
const RSS_GROWTH_RATIO = 0.2;
const FD_GROWTH = 8;

export async function runCompanionLeakTest(): Promise<void> {
	const handle = await startCompanion();
	try {
		const report = await runScenarios(handle);
		const rssDelta = report.afterRssKb - report.warmupRssKb;
		const fdDelta = report.afterFds - report.warmupFds;
		if (
			rssDelta > RSS_GROWTH_KB &&
			report.afterRssKb > report.warmupRssKb * (1 + RSS_GROWTH_RATIO)
		) {
			throw new Error(
				`rss grew ${rssDelta}kB (${report.warmupRssKb} -> ${report.afterRssKb})`,
			);
		}
		if (fdDelta > FD_GROWTH) {
			throw new Error(
				`fds grew ${fdDelta} (${report.warmupFds} -> ${report.afterFds})`,
			);
		}
		await handle.stop();
		await Bun.sleep(300);
		const after = census(handle.pid, handle.root);
		const leftovers = leftoverLabels(after);
		if (leftovers.length || after.zombies.length) {
			throw new Error(
				`after SIGTERM leftovers ${leftovers.join(",") || "none"} zombies=${after.zombies.length}`,
			);
		}
		console.log(
			`companion-emulator ok rss ${report.warmupRssKb}kB -> ${report.afterRssKb}kB fds ${report.warmupFds} -> ${report.afterFds}`,
		);
	} catch (caught) {
		const message = caught instanceof Error ? caught.message : String(caught);
		const logs = handle.logs.join("").trim();
		await handle.stop().catch(() => undefined);
		throw new Error(logs ? `${message}\n--- companion ---\n${logs}` : message);
	}
}

if (import.meta.main) {
	await runCompanionLeakTest();
}
