import { readFileSync } from "node:fs";

export const DEVICE_TREE_MODEL_PATH = "/proc/device-tree/model";
export const BOARD_MODEL_MAX = 80;

export function parseBoardModel(raw: string): string {
	return raw
		.replace(/\0/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, BOARD_MODEL_MAX);
}

export function readBoardModel(
	path = DEVICE_TREE_MODEL_PATH,
): string | undefined {
	try {
		const model = parseBoardModel(readFileSync(path, "utf8"));
		return model || undefined;
	} catch {
		return undefined;
	}
}
