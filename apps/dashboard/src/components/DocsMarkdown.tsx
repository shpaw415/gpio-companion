import { useMemo } from "react";
import { renderDocsMarkdown } from "../lib/markdown.ts";

export default function DocsMarkdown({
	content,
	className,
}: {
	content: string;
	className?: string;
}) {
	const html = useMemo(() => renderDocsMarkdown(content), [content]);
	return (
		<div
			className={className ? `docs-markdown ${className}` : "docs-markdown"}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: official gpio-companion documentation bundled from the monorepo at build time; no user-generated content flows through here.
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
