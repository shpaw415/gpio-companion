import { useMemo, useState } from "react";
import DocsMarkdown from "../components/DocsMarkdown.tsx";
import { Chip, Field, Muted, Paper, Row, Screen, TextButton, Title } from "../components/ui.tsx";
import { useUserBoards } from "../lib/api-cache.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import {
	DOC_HARDWARE_LABELS,
	DOCS,
	type DocHardware,
	docSections,
	findDoc,
	hardwareFromStatus,
	searchDocs,
} from "../lib/docs.ts";

export default function Docs() {
	const { uuid } = useBoardSelection();
	const [query, setQuery] = useState("");
	const [family, setFamily] = useState<DocHardware | "all">("all");
	const [docId, setDocId] = useState("");
	const { boards } = useUserBoards();
	const selected = boards.find((board) => board.device.uuid === uuid);
	const inferred = hardwareFromStatus(selected?.status?.model, selected?.status?.hardware);

	const catalog = useMemo(() => {
		return DOCS.filter((entry) => {
			if (entry.group !== "hardware") {
				return true;
			}
			if (family === "all") {
				return true;
			}
			return entry.hardware === family;
		});
	}, [family]);

	const hits = useMemo(() => searchDocs(query, catalog), [query, catalog]);
	const doc = findDoc(docId);

	return (
		<Screen>
			<Title>Docs</Title>
			<Row>
				<Chip
					label="All"
					filled={family === "all"}
					tone={family === "all" ? "primary" : "muted"}
					onPress={() => setFamily("all")}
				/>
				{(Object.keys(DOC_HARDWARE_LABELS) as DocHardware[]).map((key) => (
					<Chip
						key={key}
						label={DOC_HARDWARE_LABELS[key]}
						filled={family === key}
						tone={inferred === key || family === key ? "primary" : "muted"}
						onPress={() => setFamily(key)}
					/>
				))}
			</Row>
			<Field label="Search" value={query} onChangeText={setQuery} placeholder="Search docs" />
			{doc ? (
				<Paper>
					<TextButton label="Back to catalog" onPress={() => setDocId("")} />
					<Title>{doc.title}</Title>
					{docSections(doc.content)
						.filter((section) => section.level > 0 && section.level <= 3)
						.map((section) => (
							<Muted key={section.id}>{section.title}</Muted>
						))}
					<DocsMarkdown content={doc.content} onOpenDoc={setDocId} />
				</Paper>
			) : hits.length > 0 ? (
				hits.map((hit) => (
					<Paper key={`${hit.docId}-${hit.sectionTitle}`} onPress={() => setDocId(hit.docId)}>
						<TextButton label={hit.docTitle} onPress={() => setDocId(hit.docId)} />
						<Muted>{hit.snippet}</Muted>
					</Paper>
				))
			) : (
				catalog.map((entry) => (
					<Paper key={entry.id} onPress={() => setDocId(entry.id)}>
						<TextButton label={entry.title} onPress={() => setDocId(entry.id)} />
						<Muted>{entry.description}</Muted>
					</Paper>
				))
			)}
		</Screen>
	);
}
