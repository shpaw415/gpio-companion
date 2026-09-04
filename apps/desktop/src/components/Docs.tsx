import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useMemo, useState } from "react";
import DocsMarkdown from "./DocsMarkdown";
import { useUserBoards } from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import {
	DOC_HARDWARE_LABELS,
	DOCS,
	type DocHardware,
	docSections,
	findDoc,
	hardwareFromStatus,
	searchDocs,
} from "../lib/docs";

export default function Docs() {
	const { uuid } = useBoardSelection();
	const [query, setQuery] = useState("");
	const [family, setFamily] = useState<DocHardware | "all">("all");
	const [docId, setDocId] = useState("");
	const { boards } = useUserBoards();

	const selected = boards.find((board) => board.device.uuid === uuid);
	const inferred = hardwareFromStatus(
		selected?.status?.model,
		selected?.status?.hardware,
	);

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
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Docs
			</Typography>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
				<Chip
					label="All"
					variant={family === "all" ? "filled" : "outlined"}
					onClick={() => setFamily("all")}
				/>
				{(Object.keys(DOC_HARDWARE_LABELS) as DocHardware[]).map((key) => (
					<Chip
						key={key}
						label={DOC_HARDWARE_LABELS[key]}
						color={inferred === key ? "primary" : "secondary"}
						variant={family === key ? "filled" : "outlined"}
						onClick={() => setFamily(key)}
					/>
				))}
			</Stack>
			<TextField
				label="Search"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
			{doc ? (
				<Paper sx={{ p: 3 }} elevation={1}>
					<Button variant="text" onClick={() => setDocId("")}>
						Back to catalog
					</Button>
					<Typography variant="h6" sx={{ mt: 1 }}>
						{doc.title}
					</Typography>
					<Stack spacing={0.5} sx={{ mt: 2, mb: 3 }}>
						{docSections(doc.content)
							.filter((section) => section.level > 0 && section.level <= 3)
							.map((section) => (
								<Button
									key={section.id}
									variant="text"
									size="small"
									sx={{
										justifyContent: "flex-start",
										pl: Math.max(0, section.level - 1) * 2,
									}}
									onClick={() =>
										document.getElementById(section.id)?.scrollIntoView({
											behavior: "smooth",
											block: "start",
										})
									}
								>
									{section.title}
								</Button>
							))}
					</Stack>
					<DocsMarkdown content={doc.content} onOpenDoc={setDocId} />
				</Paper>
			) : (
				<>
					{hits.length > 0
						? hits.map((hit) => (
								<Paper key={`${hit.docId}-${hit.sectionTitle}`} sx={{ p: 2 }} elevation={1}>
									<Button variant="text" onClick={() => setDocId(hit.docId)}>
										{hit.docTitle}
									</Button>
									<Typography color="secondary">{hit.snippet}</Typography>
								</Paper>
							))
						: catalog.map((entry) => (
								<Paper key={entry.id} sx={{ p: 2 }} elevation={1}>
									<Button variant="text" onClick={() => setDocId(entry.id)}>
										{entry.title}
									</Button>
									<Typography color="secondary">{entry.description}</Typography>
								</Paper>
							))}
				</>
			)}
		</Stack>
	);
}
