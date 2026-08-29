import { rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export async function revokeT3Authorization(): Promise<void> {
	const home = process.env.HOME || homedir();
	const dirs = [
		join(home, ".t3"),
		join(home, ".config/t3"),
		join(home, ".local/share/t3"),
	];
	for (const dir of dirs) {
		await rm(dir, { recursive: true, force: true }).catch(() => undefined);
	}
	await Bun.spawn(["t3", "logout"], {
		stdout: "ignore",
		stderr: "ignore",
	}).exited.catch(() => 0);
	await Bun.spawn(["systemctl", "restart", "t3"], {
		stdout: "ignore",
		stderr: "ignore",
	}).exited.catch(() => 0);
}
