import { describe, expect, test } from "bun:test";
import { searchDocs } from "./doc-search.ts";
import {
	DOC_HARDWARE_LABELS,
	DOCS,
	docSections,
	docUrl,
	findDoc,
	rewriteDocLinks,
	stripMarkdownFrontmatter,
} from "./docs.ts";
import { renderDocsMarkdown, slugifyHeading } from "./markdown.ts";

describe("docs registry", () => {
	test("registers guides and per-hardware docs", () => {
		expect(DOCS.filter((doc) => doc.group === "guides").length).toBe(5);
		expect(
			DOCS.filter((doc) => doc.group === "hardware").map((doc) => doc.hardware),
		).toEqual(["raspberrypi", "orangepi"]);
	});

	test("finds docs by id and rejects unknown ids", () => {
		expect(findDoc("getting-started")?.group).toBe("guides");
		expect(findDoc("pinout-orangepi")?.hardware).toBe("orangepi");
		expect(findDoc("nope")).toBeNull();
		expect(findDoc("")).toBeNull();
		expect(findDoc(null)).toBeNull();
	});

	test("doc urls keep ids and sections readable", () => {
		expect(docUrl("getting-started")).toBe("/devices/docs?id=getting-started");
		expect(docUrl("pinout-raspberrypi", "40-pin-header")).toBe(
			"/devices/docs?id=pinout-raspberrypi#40-pin-header",
		);
	});

	test("hardware labels cover both families", () => {
		expect(DOC_HARDWARE_LABELS.raspberrypi).toBe("Raspberry Pi");
		expect(DOC_HARDWARE_LABELS.orangepi).toBe("Orange Pi");
	});
});

describe("stripMarkdownFrontmatter", () => {
	test("removes a leading frontmatter block", () => {
		const content =
			"---\nname: gpio-pinout-orangepi\ndescription: >-\n  long\n---\n# Orange Pi GPIO pinout\n\nBody";
		expect(stripMarkdownFrontmatter(content).startsWith("# Orange Pi")).toBe(
			true,
		);
	});

	test("keeps content without frontmatter", () => {
		expect(stripMarkdownFrontmatter("# Title\n\nBody")).toBe("# Title\n\nBody");
	});

	test("keeps content when the block never closes", () => {
		expect(stripMarkdownFrontmatter("---\nunclosed")).toBe("---\nunclosed");
	});
});

describe("rewriteDocLinks", () => {
	test("rewrites relative md links to docs routes", () => {
		expect(rewriteDocLinks("see [wifi](./wifi-bluetooth.md)")).toBe(
			"see [wifi](/devices/docs?id=wifi-bluetooth)",
		);
	});

	test("leaves external and unknown links alone", () => {
		expect(rewriteDocLinks("[docs](https://gpio-companion.com)")).toBe(
			"[docs](https://gpio-companion.com)",
		);
		expect(rewriteDocLinks("[x](./unknown.md)")).toBe("[x](./unknown.md)");
	});
});

describe("docSections", () => {
	test("splits headings with slug ids and keeps body text", () => {
		const sections = docSections(
			"# Title\n\nIntro\n\n## Daily Work\n\nBody A\n\n## Power & Ground\n\nBody B",
		);
		expect(sections.map((s) => s.title)).toEqual([
			"Title",
			"Daily Work",
			"Power & Ground",
		]);
		expect(sections[0]?.body).toContain("Intro");
		expect(sections[1]?.id).toBe("daily-work");
		expect(sections[2]?.id).toBe("power-ground");
	});

	test("skips code-fence hashes inside bodies", () => {
		const sections = docSections(
			"## Detect\n\n```sh\ntr -d '\\0' < /proc/device-tree/model\n# not a heading\n```\n",
		);
		expect(sections.map((s) => s.title)).toEqual(["Detect"]);
	});
});

describe("searchDocs", () => {
	const docs = DOCS;

	test("returns nothing for blank queries", () => {
		expect(searchDocs("   ", docs)).toEqual([]);
	});

	test("matches all terms across title, headings, and body", () => {
		const hits = searchDocs("pairing key", docs);
		expect(hits.length).toBeGreaterThan(0);
		expect(hits.every((hit) => hit.docId.length > 0)).toBe(true);
	});

	test("ranks title matches above body matches", () => {
		const hits = searchDocs("pinout", docs);
		expect(hits[0]?.docTitle).toContain("pinout");
	});

	test("scopes to a single doc for in-doc search", () => {
		const doc = findDoc("getting-started");
		if (!doc) throw new Error("missing doc");
		const hits = searchDocs("pair", [doc]);
		expect(hits.every((hit) => hit.docId === "getting-started")).toBe(true);
		expect(hits.length).toBeGreaterThan(0);
	});

	test("snippets are trimmed and non-empty", () => {
		for (const hit of searchDocs("gpio", docs)) {
			expect(hit.snippet.trim().length).toBeGreaterThan(0);
		}
	});

	test("requires every term to match somewhere", () => {
		expect(searchDocs("raspberrypi zzzz-not-a-term", docs)).toEqual([]);
	});
});

describe("renderDocsMarkdown", () => {
	test("adds slug ids to headings", () => {
		const html = renderDocsMarkdown("## Power & Ground\n\nBody");
		expect(html).toContain('<h2 id="power-ground">');
	});

	test("opens external links in a new tab", () => {
		const html = renderDocsMarkdown("[site](https://gpio-companion.com)");
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	test("keeps internal links in the same tab", () => {
		const html = renderDocsMarkdown("[guide](/devices/docs?id=user-guide)");
		expect(html).not.toContain("target=");
	});

	test("renders tables with bordered cells", () => {
		const html = renderDocsMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
		expect(html).toContain("<table>");
		expect(html).toContain("<th>a</th>");
	});
});

describe("slugifyHeading", () => {
	test("lowercases and dashes alphanumeric runs", () => {
		expect(slugifyHeading("40-pin header — power and ground")).toBe(
			"40-pin-header-power-and-ground",
		);
	});

	test("unescapes entities before dashing", () => {
		expect(slugifyHeading("Power &amp; Ground")).toBe("power-ground");
	});
});
