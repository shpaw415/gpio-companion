import {
	capLogText,
	LOG_JOURNAL_UNITS,
	LOGS_MAX_LINES,
	redactLogText,
} from "gpio-companion";
import { privileged } from "./priv.ts";

export function journalctlArgs(): string[] {
	const units = LOG_JOURNAL_UNITS.flatMap((unit) => ["-u", unit]);
	return [
		"journalctl",
		...units,
		"--since",
		"24 hours ago",
		"-n",
		String(LOGS_MAX_LINES),
		"--no-pager",
		"-o",
		"short-iso",
	];
}

export async function readJournalLogs(
	spawn: typeof Bun.spawn = Bun.spawn,
): Promise<string> {
	try {
		const proc = spawn(privileged(journalctlArgs()), {
			stdout: "pipe",
			stderr: "pipe",
		});
		const text = await new Response(proc.stdout).text();
		await proc.exited;
		return capLogText(redactLogText(text));
	} catch {
		return "";
	}
}
