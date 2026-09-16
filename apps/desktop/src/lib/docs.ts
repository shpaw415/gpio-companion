import type { MessageKey, Messages } from "gpio-companion-i18n";
import gettingStartedFr from "../../../../documentation/user/fr/getting-started.md?raw";
import pinoutOrangeFr from "../../../../documentation/user/fr/pinout-orangepi.md?raw";
import pinoutRaspberryFr from "../../../../documentation/user/fr/pinout-raspberrypi.md?raw";
import userGuideFr from "../../../../documentation/user/fr/README.md?raw";
import storageFr from "../../../../documentation/user/fr/storage.md?raw";
import wifiBluetoothFr from "../../../../documentation/user/fr/wifi-bluetooth.md?raw";
import workflowsFr from "../../../../documentation/user/fr/workflows.md?raw";
import gettingStartedContent from "../../../../documentation/user/getting-started.md?raw";
import userGuideContent from "../../../../documentation/user/README.md?raw";
import storageContent from "../../../../documentation/user/storage.md?raw";
import wifiBluetoothContent from "../../../../documentation/user/wifi-bluetooth.md?raw";
import workflowsContent from "../../../../documentation/user/workflows.md?raw";
import pinoutOrangeContent from "../../../../opencode/skills/gpio-pinout-orangepi/SKILL.md?raw";
import pinoutRaspberryContent from "../../../../opencode/skills/gpio-pinout-raspberrypi/SKILL.md?raw";
import { slugifyHeading } from "./markdown";

export type DocHardware = "raspberrypi" | "orangepi";

export type DocEntry = {
	id: string;
	titleKey: MessageKey<Messages>;
	descriptionKey: MessageKey<Messages>;
	group: "guides" | "hardware";
	hardware?: DocHardware;
	content: string;
};

export type DocSection = {
	id: string;
	title: string;
	level: number;
	body: string;
};

export const DOC_HARDWARE_LABELS: Record<DocHardware, string> = {
	raspberrypi: "Raspberry Pi",
	orangepi: "Orange Pi",
};

const DOC_LINK_TARGETS: Record<string, string> = {
	"getting-started.md": "getting-started",
	"README.md": "user-guide",
	"wifi-bluetooth.md": "wifi-bluetooth",
	"workflows.md": "workflows",
	"storage.md": "storage",
};

export function rewriteDocLinks(content: string): string {
	return content.replace(
		/\]\((?:\.\/)?(README|getting-started|wifi-bluetooth|workflows|storage)\.md\)/g,
		(_match, file: string) => `](#doc:${DOC_LINK_TARGETS[`${file}.md`]})`,
	);
}

export function stripMarkdownFrontmatter(content: string): string {
	if (!content.startsWith("---")) {
		return content;
	}
	const end = content.indexOf("\n---", 3);
	if (end === -1) {
		return content;
	}
	const after = content.indexOf("\n", end + 4);
	return after === -1 ? "" : content.slice(after + 1).replace(/^\r?\n+/, "");
}

export function docSections(content: string): DocSection[] {
	const lines = content.split("\n");
	const sections: DocSection[] = [];
	let current: DocSection | null = null;
	let inFence = false;
	for (const line of lines) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
		}
		const match = inFence ? null : /^(#{1,4})\s+(.*)$/.exec(line);
		if (match) {
			current = {
				id: slugifyHeading(match[2] ?? ""),
				title: match[2] ?? "",
				level: match[1]?.length ?? 1,
				body: "",
			};
			sections.push(current);
			continue;
		}
		if (!current) {
			current = { id: "", title: "", level: 0, body: "" };
			sections.push(current);
			continue;
		}
		current.body = `${current.body}${line}\n`;
	}
	return sections.filter(
		(section) => section.level > 0 || section.body.trim().length > 0,
	);
}

function doc(entry: Omit<DocEntry, "content"> & { raw: string }): DocEntry {
	const { raw, ...rest } = entry;
	return {
		...rest,
		content: rewriteDocLinks(stripMarkdownFrontmatter(raw)),
	};
}

function pickRaw(locale: string, en: string, fr: string): string {
	return locale === "fr" ? fr : en;
}

export function docsForLocale(locale: string): DocEntry[] {
	return [
		doc({
			id: "getting-started",
			titleKey: "docs.gettingStartedTitle",
			descriptionKey: "docs.gettingStartedDesc",
			group: "guides",
			raw: pickRaw(locale, gettingStartedContent, gettingStartedFr),
		}),
		doc({
			id: "user-guide",
			titleKey: "docs.userGuideTitle",
			descriptionKey: "docs.userGuideDesc",
			group: "guides",
			raw: pickRaw(locale, userGuideContent, userGuideFr),
		}),
		doc({
			id: "wifi-bluetooth",
			titleKey: "docs.wifiBluetoothTitle",
			descriptionKey: "docs.wifiBluetoothDesc",
			group: "guides",
			raw: pickRaw(locale, wifiBluetoothContent, wifiBluetoothFr),
		}),
		doc({
			id: "workflows",
			titleKey: "docs.workflowsTitle",
			descriptionKey: "docs.workflowsDesc",
			group: "guides",
			raw: pickRaw(locale, workflowsContent, workflowsFr),
		}),
		doc({
			id: "storage",
			titleKey: "docs.storageTitle",
			descriptionKey: "docs.storageDesc",
			group: "guides",
			raw: pickRaw(locale, storageContent, storageFr),
		}),
		doc({
			id: "pinout-raspberrypi",
			titleKey: "docs.pinoutPiTitle",
			descriptionKey: "docs.pinoutPiDesc",
			group: "hardware",
			hardware: "raspberrypi",
			raw: pickRaw(locale, pinoutRaspberryContent, pinoutRaspberryFr),
		}),
		doc({
			id: "pinout-orangepi",
			titleKey: "docs.pinoutOrangeTitle",
			descriptionKey: "docs.pinoutOrangeDesc",
			group: "hardware",
			hardware: "orangepi",
			raw: pickRaw(locale, pinoutOrangeContent, pinoutOrangeFr),
		}),
	];
}

export const DOCS: DocEntry[] = docsForLocale("en");

export function findDoc(
	id: string | null | undefined,
	docs: DocEntry[] = DOCS,
): DocEntry | null {
	const trimmed = id?.trim() ?? "";
	if (!trimmed) {
		return null;
	}
	return docs.find((entry) => entry.id === trimmed) ?? null;
}

export function hardwareFromStatus(
	model?: string,
	hardware?: string,
): DocHardware | null {
	const text = `${model ?? ""} ${hardware ?? ""}`.toLowerCase();
	if (text.includes("orange")) {
		return "orangepi";
	}
	if (text.includes("raspberry") || text.includes("bcm")) {
		return "raspberrypi";
	}
	return null;
}

export function searchDocs(
	query: string,
	docs: Array<DocEntry & { title: string }>,
	limit = 12,
) {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) {
		return [];
	}
	const hits: Array<{
		docId: string;
		docTitle: string;
		sectionTitle: string;
		snippet: string;
	}> = [];
	for (const entry of docs) {
		for (const section of docSections(entry.content)) {
			const hay =
				`${entry.title} ${section.title} ${section.body}`.toLowerCase();
			if (!terms.every((term) => hay.includes(term))) {
				continue;
			}
			hits.push({
				docId: entry.id,
				docTitle: entry.title,
				sectionTitle: section.title,
				snippet: section.body.replace(/\s+/g, " ").trim().slice(0, 160),
			});
		}
	}
	return hits.slice(0, limit);
}
