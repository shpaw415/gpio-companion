import { type DocEntry, docSections } from "./docs.ts";

export type DocSearchHit = {
	docId: string;
	docTitle: string;
	sectionId: string;
	sectionTitle: string;
	snippet: string;
	score: number;
};

const SNIPPET_RADIUS = 80;

function snippetAround(body: string, terms: string[]): string {
	const flat = body.replace(/\s+/g, " ").trim();
	if (!flat) {
		return "";
	}
	const lower = flat.toLowerCase();
	let index = -1;
	for (const term of terms) {
		const at = lower.indexOf(term);
		if (at !== -1 && (index === -1 || at < index)) {
			index = at;
		}
	}
	if (index === -1) {
		return flat.slice(0, SNIPPET_RADIUS * 2);
	}
	const start = Math.max(0, index - SNIPPET_RADIUS);
	const end = Math.min(
		flat.length,
		index + termLengthAround(lower, index, terms) + SNIPPET_RADIUS,
	);
	const prefix = start > 0 ? "…" : "";
	const suffix = end < flat.length ? "…" : "";
	return `${prefix}${flat.slice(start, end)}${suffix}`;
}

function termLengthAround(
	lower: string,
	index: number,
	terms: string[],
): number {
	for (const term of terms) {
		if (lower.startsWith(term, index)) {
			return term.length;
		}
	}
	return 0;
}

export function searchDocs(
	query: string,
	docs: DocEntry[],
	limit = 12,
): DocSearchHit[] {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) {
		return [];
	}

	const hits: DocSearchHit[] = [];
	for (const doc of docs) {
		const docTitle = doc.title.toLowerCase();
		for (const section of docSections(doc.content)) {
			const sectionTitle = section.title.toLowerCase();
			const body = section.body.toLowerCase();
			const inTitle = terms.filter((term) => docTitle.includes(term)).length;
			const inHeading = terms.filter((term) =>
				sectionTitle.includes(term),
			).length;
			const inBody = terms.filter((term) => body.includes(term)).length;
			if (inTitle + inHeading + inBody !== terms.length) {
				continue;
			}
			hits.push({
				docId: doc.id,
				docTitle: doc.title,
				sectionId: section.id,
				sectionTitle: section.title,
				snippet: snippetAround(section.body, terms),
				score: inTitle * 12 + inHeading * 6 + inBody * 2,
			});
		}
	}

	hits.sort((a, b) => b.score - a.score);
	return hits.slice(0, limit);
}
