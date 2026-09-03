export type BoardSeedEntry = {
	slug: string;
	dir: string;
	hardware: string;
	match: string[];
	exact: boolean;
};

export type BoardSeedManifest = {
	boards: BoardSeedEntry[];
};

export type ResolvedBoardSeed = {
	slug: string;
	dir: string;
	hardware: string;
	exact: boolean;
};

export function normalizeBoardModel(model: string): string {
	return model.toLowerCase().replace(/\s+/g, " ").trim();
}

function toResolved(entry: BoardSeedEntry): ResolvedBoardSeed {
	return {
		slug: entry.slug,
		dir: entry.dir,
		hardware: entry.hardware,
		exact: entry.exact,
	};
}

export function parseBoardSeedManifest(input: unknown): BoardSeedManifest {
	if (input === null || typeof input !== "object") {
		throw new Error("board seed manifest must be an object");
	}
	const boards = (input as { boards?: unknown }).boards;
	if (!Array.isArray(boards) || boards.length === 0) {
		throw new Error("board seed manifest must have a non-empty boards array");
	}
	const seenSlugs = new Set<string>();
	for (const board of boards) {
		if (board === null || typeof board !== "object") {
			throw new Error("board seed entries must be objects");
		}
		const record = board as Record<string, unknown>;
		for (const key of ["slug", "dir", "hardware"] as const) {
			if (typeof record[key] !== "string" || !record[key]) {
				throw new Error(`board seed entry field ${key} must be a string`);
			}
		}
		if (seenSlugs.has(String(record.slug))) {
			throw new Error(`duplicate board seed slug: ${String(record.slug)}`);
		}
		seenSlugs.add(String(record.slug));
		const match = record.match;
		if (
			!Array.isArray(match) ||
			match.some((needle) => typeof needle !== "string" || !needle) ||
			match.length === 0
		) {
			throw new Error(
				`board seed entry ${String(record.slug)} needs a non-empty match array`,
			);
		}
		if (typeof record.exact !== "boolean") {
			throw new Error(
				`board seed entry ${String(record.slug)} needs an exact boolean`,
			);
		}
	}
	return { boards: boards as BoardSeedEntry[] };
}

export function resolveBoardSeed(
	manifest: BoardSeedManifest,
	model: string,
): ResolvedBoardSeed | null {
	const normalized = normalizeBoardModel(model);
	if (!normalized) {
		return null;
	}
	let best: ResolvedBoardSeed | null = null;
	let bestScore = -1;
	for (const entry of manifest.boards) {
		for (const rawNeedle of entry.match) {
			const needle = normalizeBoardModel(rawNeedle);
			if (!needle || !normalized.includes(needle)) {
				continue;
			}
			const score = (entry.exact ? 1_000 : 0) + needle.length;
			if (score > bestScore) {
				best = toResolved(entry);
				bestScore = score;
			}
		}
	}
	return best;
}

export function familyFallbackSeed(
	manifest: BoardSeedManifest,
	hardware: string,
): ResolvedBoardSeed | null {
	for (const entry of manifest.boards) {
		if (entry.hardware === hardware && !entry.exact) {
			return toResolved(entry);
		}
	}
	return null;
}
