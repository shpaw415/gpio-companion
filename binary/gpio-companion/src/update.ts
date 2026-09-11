import { privileged } from "./priv.ts";

export const UPDATE_UNIT = "gpio-companion-update.service";

export type ApplyUpdate = () => Promise<void>;

export function applySystemdUpdate(
	spawn: typeof Bun.spawn = Bun.spawn,
): ApplyUpdate {
	return async () => {
		const systemctl = process.env.GPIO_COMPANION_SYSTEMCTL ?? "systemctl";
		if (!process.env.GPIO_COMPANION_SYSTEMCTL && !Bun.which("systemctl")) {
			throw new Error("systemctl is not available");
		}
		const cmd = process.env.GPIO_COMPANION_SYSTEMCTL
			? [systemctl, "start", "--no-block", UPDATE_UNIT]
			: privileged(["systemctl", "start", "--no-block", UPDATE_UNIT]);
		const proc = spawn(cmd, {
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stderr, code] = await Promise.all([
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		if (code !== 0) {
			throw new Error(stderr.trim() || "update start failed");
		}
	};
}
