export const PROJECT_FILE_DIRS = ["pcb", "breadboard", "technical"] as const;

export type ProjectFileDir = (typeof PROJECT_FILE_DIRS)[number];

export const PCB_CIRCUIT_JSON = "pcb/circuit.json";
export const PCB_PREVIEW_SVG = "pcb/preview.svg";
export const BREADBOARD_CIRCUIT_JSON = "breadboard/circuit.json";
export const BREADBOARD_PREVIEW_SVG = "breadboard/preview.svg";

export function isProjectFileDir(value: string): value is ProjectFileDir {
	return (PROJECT_FILE_DIRS as readonly string[]).includes(value);
}
