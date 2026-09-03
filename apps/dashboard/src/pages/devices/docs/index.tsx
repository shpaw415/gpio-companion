import { GET as getDevice } from "@api/device";
import { GET as getPairing } from "@api/pair";
import SearchIcon from "@material-design-icons/svg/filled/search.svg";
import { ThrowNotFound } from "@next/client";
import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Breadcrumbs from "@shpaw415/mui-lite/Breadcrumbs";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Link from "@shpaw415/mui-lite/Link";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { DeviceStatus } from "../../../components/DeviceBoardCard.tsx";
import DeviceSelect from "../../../components/DeviceSelect.tsx";
import DocsMarkdown from "../../../components/DocsMarkdown.tsx";
import SectionHub, { SectionHeader } from "../../../components/Section.tsx";
import { SelectSkeleton } from "../../../components/skeletons.tsx";
import { useActionError } from "../../../hooks/useActionError.tsx";
import { useAuthSession } from "../../../hooks/useAuth.ts";
import { useBoardSelection } from "../../../hooks/useBoardSelection.tsx";
import useMobile from "../../../hooks/useMobile.ts";
import { searchDocs } from "../../../lib/doc-search.ts";
import {
	DOC_HARDWARE_LABELS,
	DOCS,
	type DocEntry,
	type DocHardware,
	docSections,
	docUrl,
	findDoc,
} from "../../../lib/docs.ts";
import type { StoredPairing } from "../../../lib/pairing-store.ts";

type BoardView = {
	device: StoredPairing;
	status: DeviceStatus | null;
};

function readDocIdParam(): string {
	if (typeof window === "undefined") {
		return "";
	}
	return new URLSearchParams(window.location.search).get("id")?.trim() ?? "";
}

function asDocHardware(value: string | undefined): DocHardware | null {
	return value === "raspberrypi" || value === "orangepi" ? value : null;
}

function highlight(text: string, query: string): ReactNode[] {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) {
		return [text];
	}
	const nodes: ReactNode[] = [];
	let rest = text;
	let key = 0;
	while (rest) {
		const lower = rest.toLowerCase();
		let index = -1;
		let term = "";
		for (const candidate of terms) {
			const at = lower.indexOf(candidate);
			if (at !== -1 && (index === -1 || at < index)) {
				index = at;
				term = candidate;
			}
		}
		if (index === -1) {
			nodes.push(rest);
			break;
		}
		if (index > 0) {
			nodes.push(rest.slice(0, index));
		}
		nodes.push(
			<mark key={key++}>{rest.slice(index, index + term.length)}</mark>,
		);
		rest = rest.slice(index + term.length);
	}
	return nodes;
}

export default function DocsPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const mobile = useMobile();
	const { uuid: selectedUuid, setUuid: selectBoard } = useBoardSelection();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [boards, setBoards] = useState<BoardView[]>([]);
	const [boardsLoading, setBoardsLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [familyOverride, setFamilyOverride] = useState<
		DocHardware | "all" | null
	>(null);
	const [docId] = useState(readDocIdParam);

	const doc = findDoc(docId);
	if (docId && !doc) {
		ThrowNotFound();
	}

	useEffect(() => {
		if (!session.data?.id) {
			setBoards([]);
			setBoardsLoading(false);
			return;
		}
		setBoardsLoading(true);
		void run(getPairing())
			.then(async (result) => {
				if (!result?.paired) {
					setBoards([]);
					return;
				}
				const device = await run(getDevice());
				if (device?.paired) {
					setBoards(
						device.devices.map((item) => ({
							device: item.device,
							status: item.status as DeviceStatus | null,
						})),
					);
				} else {
					setBoards(
						result.devices.map((item) => ({ device: item, status: null })),
					);
				}
			})
			.finally(() => {
				setBoardsLoading(false);
			});
	}, [session.data?.id, run]);

	const [prevSelectedUuid, setPrevSelectedUuid] = useState(selectedUuid);
	if (prevSelectedUuid !== selectedUuid) {
		setPrevSelectedUuid(selectedUuid);
		setFamilyOverride(null);
	}

	const selectedBoard =
		boards.find((board) => board.device.uuid === selectedUuid) ?? null;
	const boardHardware = asDocHardware(selectedBoard?.status?.hardware);
	const familyFocus: DocHardware | "all" =
		familyOverride ?? boardHardware ?? "all";

	const results = useMemo(
		() => (query.trim() ? searchDocs(query, DOCS) : []),
		[query],
	);
	const guides = useMemo(() => DOCS.filter((d) => d.group === "guides"), []);
	const hardwareDocs = useMemo(
		() =>
			familyFocus === "all"
				? DOCS.filter((d) => d.group === "hardware")
				: DOCS.filter((d) => d.hardware === familyFocus),
		[familyFocus],
	);

	useEffect(() => {
		if (!doc) {
			return;
		}
		const hash = window.location.hash.replace(/^#/, "");
		if (!hash) {
			return;
		}
		let tries = 0;
		const scroll = () => {
			const element = document.getElementById(hash);
			if (element) {
				element.scrollIntoView({ behavior: "smooth" });
				return;
			}
			tries += 1;
			if (tries < 20) {
				window.setTimeout(scroll, 100);
			}
		};
		scroll();
	}, [doc]);

	if (doc) {
		return <DocReader doc={doc} />;
	}

	const boardLabel = selectedBoard?.status?.model
		? selectedBoard.status.model
		: boardHardware
			? DOC_HARDWARE_LABELS[boardHardware]
			: null;

	return (
		<Stack spacing={3}>
			<SectionHeader title="Documentation">
				{mobile ? null : (
					<Typography color="secondary">
						Official gpio-companion guides and board-specific hardware docs,
						scoped to the board selected on Devices overview.
					</Typography>
				)}
			</SectionHeader>

			<Paper className="w-full p-3 min-[900px]:p-4" elevation={1}>
				<Stack
					direction={mobile ? "column" : "row"}
					spacing={1}
					className="items-stretch min-[900px]:items-center"
				>
					<Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
						{boardsLoading ? (
							<SelectSkeleton />
						) : loggedIn && boards.length > 0 ? (
							<DeviceSelect
								devices={boards.map((board) => board.device)}
								value={selectedUuid}
								onChange={selectBoard}
								label="Board"
							/>
						) : (
							<Typography color="secondary">
								{loggedIn
									? "No paired board yet — docs below cover every family."
									: "Sign in and pair a board to scope these docs to its hardware."}
							</Typography>
						)}
					</Box>
					{selectedBoard ? (
						<Stack
							direction="row"
							spacing={1}
							className="flex-wrap items-center"
						>
							<Chip
								label={selectedBoard.status ? "Online" : "Offline"}
								color={selectedBoard.status ? "success" : "secondary"}
								variant="outlined"
								size="small"
							/>
							{boardLabel ? (
								<Chip label={boardLabel} variant="outlined" size="small" />
							) : null}
						</Stack>
					) : null}
				</Stack>
				<Stack
					direction="row"
					spacing={1}
					className="mt-2 flex-wrap items-center"
				>
					<Typography variant="body2" color="secondary">
						Board docs:
					</Typography>
					{(["raspberrypi", "orangepi"] as const).map((family) => (
						<Chip
							key={family}
							label={DOC_HARDWARE_LABELS[family]}
							color={familyFocus === family ? "primary" : undefined}
							variant={familyFocus === family ? "filled" : "outlined"}
							size="small"
							onClick={() => setFamilyOverride(family)}
						/>
					))}
					<Chip
						label="All"
						color={familyFocus === "all" ? "primary" : undefined}
						variant={familyFocus === "all" ? "filled" : "outlined"}
						size="small"
						onClick={() => setFamilyOverride("all")}
					/>
				</Stack>
			</Paper>

			<Box className="w-full max-w-xl">
				<TextField
					label="Search documentation"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					className="w-full"
					startIcon={<SearchIcon fill="currentColor" />}
				/>
			</Box>

			{query.trim() ? (
				<Stack spacing={2}>
					<Typography variant="h6">
						{results.length} result{results.length === 1 ? "" : "s"} for “
						{query.trim()}”
					</Typography>
					{results.map((hit) => (
						<Paper
							key={`${hit.docId}#${hit.sectionId}`}
							className="w-full p-3 min-[900px]:p-4"
							elevation={1}
						>
							<Stack spacing={1}>
								<Typography variant="subtitle1">
									<Link href={docUrl(hit.docId, hit.sectionId)}>
										{hit.docTitle}
										{hit.sectionTitle ? ` — ${hit.sectionTitle}` : ""}
									</Link>
								</Typography>
								<Typography variant="body2" color="secondary">
									{highlight(hit.snippet, query)}
								</Typography>
							</Stack>
						</Paper>
					))}
					{results.length === 0 ? (
						<Alert severity="info">
							No documentation matches “{query.trim()}”. Try a pin number, a
							tool name (gpioinfo, nmcli, t3), or a topic like pairing or WiFi.
						</Alert>
					) : null}
				</Stack>
			) : (
				<Stack spacing={4}>
					<SectionHub
						description="Guides for the person at the desk."
						items={guides.map((entry) => ({
							href: docUrl(entry.id),
							title: entry.title,
							description: entry.description,
						}))}
					/>
					<Box>
						<Stack spacing={1} className="mb-3">
							<Typography variant="h6">
								{familyFocus === "all"
									? "Hardware"
									: `For ${DOC_HARDWARE_LABELS[familyFocus]} boards`}
							</Typography>
							<Typography color="secondary" variant="body2">
								{selectedBoard && boardHardware
									? `Scoped to ${boardLabel}${selectedBoard.device.label?.trim() ? ` (${selectedBoard.device.label.trim()})` : ""}.`
									: familyFocus === "all"
										? "Pick a board above or pin a family with the chips."
										: "Pinned via the family chips above."}
							</Typography>
						</Stack>
						<SectionHub
							description={
								familyFocus === "all"
									? "Every supported board family."
									: `Pinout and wiring for ${DOC_HARDWARE_LABELS[familyFocus]}.`
							}
							items={hardwareDocs.map((entry) => ({
								href: docUrl(entry.id),
								title: entry.title,
								description: entry.description,
							}))}
						/>
					</Box>
				</Stack>
			)}
		</Stack>
	);
}

function DocReader({ doc }: { doc: DocEntry }) {
	const mobile = useMobile();
	const [tocQuery, setTocQuery] = useState("");
	const sections = useMemo(
		() => docSections(doc.content).filter((s) => s.level >= 2 && s.level <= 3),
		[doc],
	);
	const docHits = useMemo(
		() => (tocQuery.trim() ? searchDocs(tocQuery, [doc], 8) : []),
		[doc, tocQuery],
	);

	const toc =
		docHits.length > 0
			? docHits.map((hit) => ({
					id: hit.sectionId,
					title: hit.sectionTitle || hit.docTitle,
				}))
			: sections.map((section) => ({
					id: section.id,
					title: section.title,
				}));

	const searchInDoc = (
		<TextField
			label="Search in this doc"
			value={tocQuery}
			onChange={(event) => setTocQuery(event.target.value)}
			className="w-full"
			startIcon={<SearchIcon fill="currentColor" />}
		/>
	);

	return (
		<Stack spacing={3}>
			<Stack spacing={1}>
				<Breadcrumbs aria-label="Documentation breadcrumb">
					<Link href="/devices/docs">Docs</Link>
					<Typography color="secondary">{doc.title}</Typography>
				</Breadcrumbs>
				<Stack direction="row" spacing={1} className="flex-wrap items-center">
					<Typography variant={mobile ? "h5" : "h4"} Element="h1">
						{doc.title}
					</Typography>
					{doc.hardware ? (
						<Chip
							label={DOC_HARDWARE_LABELS[doc.hardware]}
							variant="outlined"
						/>
					) : null}
				</Stack>
				<Typography color="secondary">{doc.description}</Typography>
			</Stack>

			<Box className="w-full max-w-xl">{searchInDoc}</Box>

			{mobile ? (
				<details className="docs-toc-details">
					<summary>
						{docHits.length > 0
							? `${docHits.length} matching section${docHits.length === 1 ? "" : "s"}`
							: "On this page"}
					</summary>
					<Box className="mt-2">
						<TocList items={toc} />
					</Box>
				</details>
			) : null}

			<Box className="grid gap-6 min-[900px]:grid-cols-[240px_minmax(0,1fr)]">
				<Box className="hidden min-[900px]:block">
					<Box sx={{ position: "sticky", top: 84 }}>
						<Box sx={{ maxHeight: "70dvh", overflowY: "auto" }}>
							<TocList items={toc} />
						</Box>
					</Box>
				</Box>
				<Paper className="w-full p-3 min-[900px]:p-6" elevation={1}>
					<DocsMarkdown content={doc.content} />
					<Box className="mt-6">
						<Button href="/devices/docs" variant="text">
							← All documentation
						</Button>
					</Box>
				</Paper>
			</Box>
		</Stack>
	);
}

function TocList({ items }: { items: Array<{ id: string; title: string }> }) {
	return (
		<ul className="docs-toc">
			{items.map((item) => (
				<li key={item.id || item.title}>
					<a href={item.id ? `#${item.id}` : "#"}>{item.title}</a>
				</li>
			))}
		</ul>
	);
}
