import {
	GET as listProjects,
	POST as loadProject,
	PUT as readFile,
} from "@api/projects";
import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import {
	List,
	ListItem,
	ListItemButton,
	ListItemText,
} from "@shpaw415/mui-lite/List";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import type { GithubRepo, ProjectBundle } from "../lib/github.ts";
import PcbViewer from "./PcbViewer.tsx";

export default function ProjectBrowser() {
	const [configured, setConfigured] = useState(true);
	const [repos, setRepos] = useState<GithubRepo[]>([]);
	const [error, setError] = useState("");
	const [bundle, setBundle] = useState<ProjectBundle | null>(null);
	const [pcbJson, setPcbJson] = useState<string | null>(null);

	useEffect(() => {
		listProjects()
			.then((result) => {
				setConfigured(result.configured);
				setRepos(result.repos);
			})
			.catch((err: unknown) => {
				setError(
					err instanceof Error ? err.message : "failed to list projects",
				);
			});
	}, []);

	async function openRepo(repo: GithubRepo) {
		setError("");
		setPcbJson(null);
		try {
			const next = await loadProject(repo.owner, repo.name);
			setBundle(next);
			if (next.pcbCircuitJsonUrl) {
				const file = await readFile(repo.owner, repo.name, "pcb/circuit.json");
				setPcbJson(file.text);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "failed to load project");
		}
	}

	if (!configured) {
		return (
			<Alert severity="info">
				Save a GitHub username and PAT on Keys so this dashboard can list your
				repos. Agent-pushed files live in pcb/, breadboard/, and technical/.
			</Alert>
		);
	}

	return (
		<div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
			<Paper elevation={1}>
				<List>
					{repos.map((repo) => (
						<ListItem key={repo.full_name} disablePadding>
							<ListItemButton onClick={() => void openRepo(repo)}>
								<ListItemText primary={repo.name} secondary={repo.full_name} />
							</ListItemButton>
						</ListItem>
					))}
				</List>
				{repos.length === 0 ? (
					<Typography color="secondary" className="p-4">
						No GitHub repos yet.
					</Typography>
				) : null}
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
						<FileGroup title="PCB" files={bundle.pcb} />
						<FileGroup title="Breadboard" files={bundle.breadboard} />
						<FileGroup title="Technical" files={bundle.technical} />
					</>
				) : (
					<Typography color="secondary">Select a project.</Typography>
				)}
			</Stack>
		</div>
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
