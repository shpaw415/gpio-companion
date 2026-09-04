import { describe, expect, test } from "bun:test";
import {
	DOCS,
	docSections,
	findDoc,
	hardwareFromStatus,
	rewriteDocLinks,
	searchDocs,
	stripMarkdownFrontmatter,
} from "./docs.ts";

describe("docs", () => {
	test("bundles official guides and pinouts", () => {
		expect(DOCS.map((entry) => entry.id)).toContain("getting-started");
		expect(DOCS.map((entry) => entry.id)).toContain("pinout-orangepi");
	});

	test("strips frontmatter and rewrites in-doc links", () => {
		expect(stripMarkdownFrontmatter("---\ntitle: x\n---\n\nHello")).toBe("Hello");
		expect(rewriteDocLinks("[WiFi](wifi-bluetooth.md)")).toBe(
			"[WiFi](#doc:wifi-bluetooth)",
		);
	});

	test("finds docs and infers hardware", () => {
		expect(findDoc("user-guide")?.title).toBe("User guide");
		expect(hardwareFromStatus("Orange Pi 3 LTS")).toBe("orangepi");
		expect(hardwareFromStatus(undefined, "raspberrypi")).toBe("raspberrypi");
	});

	test("search hits sections", () => {
		const hits = searchDocs("gpio", DOCS);
		expect(hits.length).toBeGreaterThan(0);
		expect(docSections("# Title\n\nBody").some((section) => section.id === "title")).toBe(
			true,
		);
	});
});
