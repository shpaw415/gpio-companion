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
		const proc = spawn([systemctl, "start", "--no-block", UPDATE_UNIT], {
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
