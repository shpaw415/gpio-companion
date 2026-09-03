import gettingStartedContent from "@docs/user/getting-started.md" with {
	type: "text",
};
import userGuideContent from "@docs/user/README.md" with { type: "text" };
import wifiBluetoothContent from "@docs/user/wifi-bluetooth.md" with {
	type: "text",
};
import workflowsContent from "@docs/user/workflows.md" with { type: "text" };
import pinoutOrangeContent from "@skills/gpio-pinout-orangepi/SKILL.md" with {
	type: "text",
};
import pinoutRaspberryContent from "@skills/gpio-pinout-raspberrypi/SKILL.md" with {
	type: "text",
};
import { slugifyHeading } from "./markdown.ts";

export type DocHardware = "raspberrypi" | "orangepi";

export type DocEntry = {
	id: string;
	title: string;
	description: string;
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
};

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

export function rewriteDocLinks(content: string): string {
	return content.replace(
		/\]\((?:\.\/)?(README|getting-started|wifi-bluetooth|workflows)\.md\)/g,
		(_match, file: string) =>
			`](/devices/docs?id=${DOC_LINK_TARGETS[`${file}.md`]})`,
	);
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
	return { ...rest, content: rewriteDocLinks(stripMarkdownFrontmatter(raw)) };
}

export const DOCS: DocEntry[] = [
	doc({
		id: "getting-started",
		title: "Getting started",
		description:
			"Power the board, get it online, sign in, pair, connect GitHub, reach the overview.",
		group: "guides",
		raw: gettingStartedContent,
	}),
	doc({
		id: "user-guide",
		title: "User guide",
		description:
			"What ships on your bench and where each gpio-companion document fits.",
		group: "guides",
		raw: userGuideContent,
	}),
	doc({
		id: "wifi-bluetooth",
		title: "WiFi over Bluetooth",
		description:
			"Chrome/Edge Web Bluetooth, native apps, and the iOS LightBlue / nRF Connect paste flow.",
		group: "guides",
		raw: wifiBluetoothContent,
	}),
	doc({
		id: "workflows",
		title: "Daily workflows",
		description:
			"Working with the on-device agent, GitHub projects, board updates, and bench safety.",
		group: "guides",
		raw: workflowsContent,
	}),
	doc({
		id: "pinout-raspberrypi",
		title: "Raspberry Pi GPIO pinout",
		description:
			"40-pin header map (BCM), power and ground seats, I2C/SPI/UART roles, and safety notes.",
		group: "hardware",
		hardware: "raspberrypi",
		raw: pinoutRaspberryContent,
	}),
	doc({
		id: "pinout-orangepi",
		title: "Orange Pi GPIO pinout",
		description:
			"40-pin power/GND seats that match the Pi layout, live SoC line resolution with gpioinfo / WiringOP.",
		group: "hardware",
		hardware: "orangepi",
		raw: pinoutOrangeContent,
	}),
];

export function findDoc(id: string | null | undefined): DocEntry | null {
	const trimmed = id?.trim() ?? "";
	if (!trimmed) {
		return null;
	}
	return DOCS.find((entry) => entry.id === trimmed) ?? null;
}

export function docUrl(id: string, sectionId?: string): string {
	const base = `/devices/docs?id=${encodeURIComponent(id)}`;
	return sectionId ? `${base}#${sectionId}` : base;
}
