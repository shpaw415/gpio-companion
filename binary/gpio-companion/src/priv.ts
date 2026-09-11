export function privileged(cmd: string[]): string[] {
	if (typeof process.getuid === "function" && process.getuid() === 0) {
		return cmd;
	}
	return ["sudo", "-n", "--", ...cmd];
}
