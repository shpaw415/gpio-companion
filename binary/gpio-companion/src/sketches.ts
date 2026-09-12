import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	type BoardSketch,
	type BoardSketchKind,
	FIRMWARE_SKETCH_DIR,
	HOST_SKETCH_DIR,
	PROJECT_FILE_DIRS,
	SKETCH_LIST_MAX,
	sketchKindDir,
} from "gpio-companion";

const SKIP = new Set<string>([
	...PROJECT_FILE_DIRS,
	".git",
	"node_modules",
	HOST_SKETCH_DIR,
	FIRMWARE_SKETCH_DIR,
]);
const SKETCH_EXT = [".c", ".ino"];

export function listBoardSketches(
	destRoot: string,
	kind: BoardSketchKind,
): BoardSketch[] {
	if (!destRoot.startsWith("/") || destRoot.includes("..")) {
		return [];
	}
	let projects: string[] = [];
	try {
		projects = readdirSync(destRoot);
	} catch {
		return [];
	}
	const sketches: BoardSketch[] = [];
	const kindDir = sketchKindDir(kind);
	for (const project of projects) {
		if (project.startsWith(".") || SKIP.has(project)) {
			continue;
		}
		const projectPath = join(destRoot, project);
		if (!isDir(projectPath)) {
			continue;
		}
		const nested = join(projectPath, kindDir);
		if (isDir(nested)) {
			pushIfSketch(sketches, project, kindDir, nested);
			for (const name of readNames(nested)) {
				if (name.startsWith(".") || SKIP.has(name)) {
					continue;
				}
				const dir = join(nested, name);
				if (!isDir(dir)) {
					continue;
				}
				pushIfSketch(sketches, project, name, dir);
				if (sketches.length >= SKETCH_LIST_MAX) {
					return sketches;
				}
			}
		}
		if (kind === "host") {
			pushIfSketch(sketches, project, project, projectPath);
		}
		if (sketches.length >= SKETCH_LIST_MAX) {
			return sketches;
		}
	}
	return sketches;
}

function pushIfSketch(
	sketches: BoardSketch[],
	project: string,
	name: string,
	dir: string,
): void {
	if (sketches.length >= SKETCH_LIST_MAX) {
		return;
	}
	if (sketches.some((item) => item.dir === dir)) {
		return;
	}
	const files = sketchBasenames(dir);
	if (!files.length) {
		return;
	}
	sketches.push({ project, name, dir, files });
}

function sketchBasenames(dir: string): string[] {
	try {
		return readdirSync(dir).filter((name) =>
			SKETCH_EXT.some((ext) => name.endsWith(ext)),
		);
	} catch {
		return [];
	}
}

function readNames(dir: string): string[] {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
}

function isDir(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
