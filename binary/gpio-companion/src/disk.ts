import type { DiskStats } from "gpio-companion";

export function parseDfPm(text: string): DiskStats | null {
	const rows = text
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	const data = rows.find((line) => !line.startsWith("Filesystem"));
	if (!data) {
		return null;
	}
	const parts = data.split(/\s+/);
	const totalMb = Number(parts[1]);
	const availMb = Number(parts[3]);
	if (!Number.isFinite(totalMb) || !Number.isFinite(availMb) || totalMb <= 0) {
		return null;
	}
	return {
		totalMb: Math.round(totalMb),
		availMb: Math.max(0, Math.round(availMb)),
	};
}

export function readDiskStats(): DiskStats | null {
	try {
		const proc = Bun.spawnSync(["df", "-Pm", "/"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		return parseDfPm(new TextDecoder().decode(proc.stdout));
	} catch {
		return null;
	}
}
