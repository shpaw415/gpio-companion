export type ReplayDecision = "new" | "replay" | "conflict";

export function classifyReplay<T>(
	existing: T | null | undefined,
	incoming: T,
): ReplayDecision {
	if (existing == null) return "new";
	return JSON.stringify(existing) === JSON.stringify(incoming)
		? "replay"
		: "conflict";
}
