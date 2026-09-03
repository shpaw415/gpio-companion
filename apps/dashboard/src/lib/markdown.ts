import { marked } from "marked";

export function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.replace(/[`*_~]/g, "")
		.replace(/<[^>]*>/g, "")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function withHeadingAnchors(html: string): string {
	return html.replace(
		/<h([1-6])>([\s\S]*?)<\/h\1>/g,
		(_match, level: string, inner: string) => {
			const slug = slugifyHeading(inner);
			if (!slug) {
				return `<h${level}>${inner}</h${level}>`;
			}
			return `<h${level} id="${slug}">${inner}</h${level}>`;
		},
	);
}

function withExternalLinks(html: string): string {
	return html.replace(
		/<a href="(https?:\/\/[^"]*)"/g,
		'<a href="$1" target="_blank" rel="noopener noreferrer"',
	);
}

export function renderDocsMarkdown(content: string): string {
	const parsed = marked.parse(content, {
		async: false,
		gfm: true,
	}) as string;
	return withExternalLinks(withHeadingAnchors(parsed));
}
