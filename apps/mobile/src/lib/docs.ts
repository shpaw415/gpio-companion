import type { MessageKey, Messages } from "gpio-companion-i18n";
import {
	gettingStarted,
	gettingStartedFr,
	pinoutOrange,
	pinoutOrangeFr,
	pinoutRaspberry,
	pinoutRaspberryFr,
	storage,
	storageFr,
	userGuide,
	userGuideFr,
	wifiBluetooth,
	wifiBluetoothFr,
	workflows,
	workflowsFr,
} from "./docs-content.ts";

export type DocHardware = "raspberrypi" | "orangepi";

export type DocEntry = {
	id: string;
	title: string;
	titleKey: MessageKey<Messages>;
	description: string;
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

export function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.replace(/[`*_~]/g, "")
		.replace(/<[^>]*>/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

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
			title: "Getting started",
			titleKey: "docs.gettingStartedTitle",
			description:
				"Pair your board, connect WiFi and GitHub, then create your first project.",
			descriptionKey: "docs.gettingStartedDesc",
			group: "guides",
			raw: pickRaw(locale, gettingStarted, gettingStartedFr),
		}),
		doc({
			id: "user-guide",
			title: "Welcome to gpio-companion",
			titleKey: "docs.userGuideTitle",
			description:
				"Meet your workbench, gather a starter kit, and learn the three safety rules.",
			descriptionKey: "docs.userGuideDesc",
			group: "guides",
			raw: pickRaw(locale, userGuide, userGuideFr),
		}),
		doc({
			id: "wifi-bluetooth",
			title: "WiFi and Bluetooth",
			titleKey: "docs.wifiBluetoothTitle",
			description:
				"Get a board online from the native apps, a browser, or an iPhone fallback.",
			descriptionKey: "docs.wifiBluetoothDesc",
			group: "guides",
			raw: pickRaw(locale, wifiBluetooth, wifiBluetoothFr),
		}),
		doc({
			id: "workflows",
			title: "Build, run, and save",
			titleKey: "docs.workflowsTitle",
			description:
				"Turn an idea into a safe circuit, run it, verify it, and save it to GitHub.",
			descriptionKey: "docs.workflowsDesc",
			group: "guides",
			raw: pickRaw(locale, workflows, workflowsFr),
		}),
		doc({
			id: "storage",
			title: "Removable storage",
			titleKey: "docs.storageTitle",
			description:
				"Open extra SD cards and USB drives in Code, then remove them safely.",
			descriptionKey: "docs.storageDesc",
			group: "guides",
			raw: pickRaw(locale, storage, storageFr),
		}),
		doc({
			id: "pinout-raspberrypi",
			title: "Raspberry Pi GPIO pinout",
			titleKey: "docs.pinoutPiTitle",
			description:
				"Find pin 1, wire a safe first LED, and explore the Raspberry Pi 40-pin header.",
			descriptionKey: "docs.pinoutPiDesc",
			group: "hardware",
			hardware: "raspberrypi",
			raw: pickRaw(locale, pinoutRaspberry, pinoutRaspberryFr),
		}),
		doc({
			id: "pinout-orangepi",
			title: "Orange Pi GPIO pinout",
			titleKey: "docs.pinoutOrangeTitle",
			description:
				"Find safe physical pins and wire a first LED on Orange Pi, including the 3 LTS.",
			descriptionKey: "docs.pinoutOrangeDesc",
			group: "hardware",
			hardware: "orangepi",
			raw: pickRaw(locale, pinoutOrange, pinoutOrangeFr),
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

export function searchDocs(query: string, docs: DocEntry[], limit = 12) {
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
