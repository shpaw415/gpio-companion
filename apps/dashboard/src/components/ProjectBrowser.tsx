import {
	GET as listProjects,
	POST as loadProject,
	PUT as readFile,
} from "@api/projects";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import { TablePagination } from "@shpaw415/mui-lite/Pagination";
import Paper from "@shpaw415/mui-lite/Paper";
import Select from "@shpaw415/mui-lite/Select";
import Stack from "@shpaw415/mui-lite/Stack";
import Table, {
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import TextField from "@shpaw415/mui-lite/TextField";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useMemo, useState } from "react";
import { unwrapAction } from "../lib/action.ts";
import type { GithubRepo, ProjectBundle } from "../lib/github.ts";
import BreadboardViewer from "./BreadboardViewer.tsx";
import PcbViewer from "./PcbViewer.tsx";

export default function ProjectBrowser({
	onConfigured,
}: {
	onConfigured?: (ready: boolean) => void;
}) {
	const [configured, setConfigured] = useState(true);
	const [repos, setRepos] = useState<GithubRepo[]>([]);
	const [error, setError] = useState("");
	const [bundle, setBundle] = useState<ProjectBundle | null>(null);
	const [pcbJson, setPcbJson] = useState<string | null>(null);
	const [breadboardJson, setBreadboardJson] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [owner, setOwner] = useState("all");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState<10 | 25 | 50 | 100>(10);

	useEffect(() => {
		listProjects()
			.then((result) => {
				const data = unwrapAction(result);
				setConfigured(data.configured);
				setRepos(data.repos);
				onConfigured?.(data.configured);
			})
			.catch((err: unknown) => {
				setError(
					err instanceof Error ? err.message : "failed to list projects",
				);
			});
	}, [onConfigured]);

	const owners = useMemo(() => {
		return [...new Set(repos.map((repo) => repo.owner))].sort();
	}, [repos]);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return repos.filter((repo) => {
			if (owner !== "all" && repo.owner !== owner) {
				return false;
			}
			if (!needle) {
				return true;
			}
			return (
				repo.name.toLowerCase().includes(needle) ||
				repo.full_name.toLowerCase().includes(needle)
			);
		});
	}, [repos, owner, query]);

	const paged = filtered.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	async function openRepo(repo: GithubRepo) {
		setError("");
		setPcbJson(null);
		setBreadboardJson(null);
		try {
			const next = unwrapAction(await loadProject(repo.owner, repo.name));
			setBundle(next);
			if (next.pcbCircuitJsonUrl) {
				const file = unwrapAction(
					await readFile(repo.owner, repo.name, "pcb/circuit.json"),
				);
				setPcbJson(file.text);
			}
			const breadboardPath = next.breadboardDiagramUrl
				? "breadboard/diagram.json"
				: next.breadboardCircuitJsonUrl
					? "breadboard/circuit.json"
					: null;
			if (breadboardPath) {
				const file = unwrapAction(
					await readFile(repo.owner, repo.name, breadboardPath),
				);
				setBreadboardJson(file.text);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "failed to load project");
		}
	}

	if (!configured) {
		return (
			<Alert severity="info">
				Install the GitHub App on Keys so this dashboard can list your repos.
				Agent-pushed files live in pcb/, breadboard/, and technical/.
			</Alert>
		);
	}

	return (
		<Stack spacing={3}>
			<Paper className="p-4" elevation={1}>
				<Stack spacing={2}>
					<Stack
						direction="row"
						spacing={2}
						sx={{ flexWrap: "wrap", alignItems: "flex-end" }}
					>
						<TextField
							label="Filter"
							placeholder="Name or owner/repo"
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setPage(0);
							}}
							className="min-w-[16rem] flex-1"
						/>
						<Select
							label="Owner"
							value={owner}
							onSelect={(next) => {
								setOwner(next);
								setPage(0);
							}}
							className="min-w-[12rem]"
						>
							<option value="all">All owners</option>
							{owners.map((login) => (
								<option key={login} value={login}>
									{login}
								</option>
							))}
						</Select>
					</Stack>
					<TableContainer>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Name</TableCell>
									<TableCell>Owner</TableCell>
									<TableCell>Repository</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{paged.map((repo) => (
									<TableRow
										key={repo.full_name}
										hover
										selected={
											bundle?.owner === repo.owner && bundle?.repo === repo.name
										}
										onClick={() => void openRepo(repo)}
									>
										<TableCell>{repo.name}</TableCell>
										<TableCell>{repo.owner}</TableCell>
										<TableCell>{repo.full_name}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
					{filtered.length === 0 ? (
						<Typography color="secondary">No matching repos.</Typography>
					) : (
						<TablePagination
							count={filtered.length}
							page={page}
							rowsPerPage={rowsPerPage}
							onPageChange={(_event, nextPage) => setPage(nextPage)}
							onRowsPerPageChange={(next) => {
								setRowsPerPage(next);
								setPage(0);
							}}
						/>
					)}
				</Stack>
			</Paper>
			<Stack spacing={3}>
				{error ? <Alert severity="error">{error}</Alert> : null}
				{bundle ? (
					<>
						<PcbViewer
							circuitJsonText={pcbJson}
							label="PCB"
							previewUrl={bundle.pcbPreviewUrl}
						/>
						<BreadboardViewer
							diagramText={breadboardJson}
							previewUrl={bundle.breadboardPreviewUrl}
						/>
						<FileGroup title="PCB" files={bundle.pcb} />
						<FileGroup title="Breadboard" files={bundle.breadboard} />
						<FileGroup title="Technical" files={bundle.technical} />
					</>
				) : (
					<Typography color="secondary">Select a project.</Typography>
				)}
			</Stack>
		</Stack>
	);
}

function FileGroup({
	title,
	files,
}: {
	title: string;
	files: { name: string; path: string; download_url: string | null }[];
}) {
	return (
		<Paper className="p-4" elevation={1}>
			<Typography variant="h6" className="mb-2">
				{title}
			</Typography>
			{files.length === 0 ? (
				<Typography color="secondary" variant="body2">
					No files in this folder.
				</Typography>
			) : (
				<Stack spacing={1}>
					{files.map((file) =>
						file.download_url ? (
							<Button
								key={file.path}
								href={file.download_url}
								variant="text"
								size="small"
							>
								{file.path}
							</Button>
						) : (
							<Typography key={file.path} variant="body2">
								{file.path}
							</Typography>
						),
					)}
				</Stack>
			)}
		</Paper>
	);
}
