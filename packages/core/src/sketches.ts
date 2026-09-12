import { FIRMWARE_SKETCH_DIR, HOST_SKETCH_DIR } from "./project-files.ts";

export type BoardSketchKind = "host" | "firmware";

export type BoardSketch = {
	project: string;
	name: string;
	dir: string;
	files: string[];
};

export type BoardSketchList = {
	sketches: BoardSketch[];
};

export function sketchKindDir(kind: BoardSketchKind): string {
	return kind === "host" ? HOST_SKETCH_DIR : FIRMWARE_SKETCH_DIR;
}

export function parseBoardSketchList(input: unknown): BoardSketchList {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("sketches must be an object");
	}
	const sketches = (input as { sketches?: unknown }).sketches;
	if (!Array.isArray(sketches)) {
		throw new Error("sketches is required");
	}
	return {
		sketches: sketches.map((item, index) => parseBoardSketch(item, index)),
	};
}

function parseBoardSketch(input: unknown, index: number): BoardSketch {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		throw new Error(`sketch ${index} must be an object`);
	}
	const record = input as Record<string, unknown>;
	const project = requiredName(record.project, "project");
	const name = requiredName(record.name, "name");
	const dir = requiredDir(record.dir);
	const filesRaw = record.files;
	if (
		!Array.isArray(filesRaw) ||
		filesRaw.some((file) => typeof file !== "string")
	) {
		throw new Error("files is required");
	}
	return {
		project,
		name,
		dir,
		files: filesRaw.filter((file) => file.trim().length > 0),
	};
}

function requiredName(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`${field} is required`);
	}
	const name = value.trim();
	if (name.includes("/") || name.includes("\\") || name.includes("..")) {
		throw new Error(`${field} is invalid`);
	}
	return name;
}

function requiredDir(value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error("dir is required");
	}
	const dir = value.trim();
	if (!dir.startsWith("/") || dir.includes("..")) {
		throw new Error("dir must be an absolute path");
	}
	return dir;
}
