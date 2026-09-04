import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import {
	getGithubApp,
	type GithubAppStatus,
	type GithubRepo,
	loadProject,
	listProjects,
	openExternal,
	type ProjectBundle,
} from "../api";
import DebugLog from "./DebugLog";

function FileGroup({
	title,
	files,
}: {
	title: string;
	files: ProjectBundle["pcb"];
}) {
	if (files.length === 0) {
		return (
			<Typography color="secondary">
				No {title} files on GitHub yet.
			</Typography>
		);
	}
	return (
		<Stack spacing={0.5}>
			<Typography variant="subtitle1">{title}</Typography>
			{files.map((file) => (
				<Typography key={file.path} color="secondary">
					{file.path}
				</Typography>
			))}
		</Stack>
	);
}

export default function Project() {
	const [app, setApp] = useState<GithubAppStatus | null>(null);
	const [repos, setRepos] = useState<GithubRepo[]>([]);
	const [configured, setConfigured] = useState(false);
	const [bundle, setBundle] = useState<ProjectBundle | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		void Promise.all([getGithubApp(), listProjects()])
			.then(([github, projects]) => {
				setApp(github);
				setConfigured(projects.configured);
				setRepos(projects.repos);
			})
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "load failed");
			});
	}, []);

	return (
		<Stack spacing={2}>
			<Typography variant="h5" Element="h1">
				Project
			</Typography>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}
			{!app?.connected ? (
				<Paper sx={{ p: 3 }} elevation={1}>
					<Typography color="secondary" sx={{ mb: 2 }}>
						Connect the gpio-companion GitHub App to list your repos.
					</Typography>
					<Button
						variant="contained"
						disabled={!app?.installUrl}
						onClick={() => void openExternal(app?.installUrl ?? "")}
					>
						Connect GitHub App
					</Button>
				</Paper>
			) : null}
			{configured
				? repos.map((repo) => (
						<Paper key={repo.full_name} sx={{ p: 2 }} elevation={1}>
							<Typography>{repo.full_name}</Typography>
							<Stack direction="row" spacing={1}>
								<Button
									variant="text"
									onClick={() => {
										void loadProject(repo.owner, repo.name)
											.then(setBundle)
											.catch((caught) => {
												setError(
													caught instanceof Error
														? caught.message
														: "load failed",
												);
											});
									}}
								>
									Open
								</Button>
								<Button
									variant="text"
									onClick={() => void openExternal(repo.html_url)}
								>
									GitHub
								</Button>
							</Stack>
						</Paper>
					))
				: null}
			{bundle ? (
				<Paper sx={{ p: 3 }} elevation={1}>
					<Typography variant="h6">
						{bundle.owner}/{bundle.repo}
					</Typography>
					<Stack spacing={2} sx={{ mt: 2 }}>
						<FileGroup title="PCB" files={bundle.pcb} />
						{bundle.pcbPreviewUrl ? (
							<img
								src={bundle.pcbPreviewUrl}
								alt="PCB preview"
								style={{ maxWidth: "100%" }}
							/>
						) : null}
						<FileGroup title="Breadboard" files={bundle.breadboard} />
						{bundle.breadboardPreviewUrl ? (
							<img
								src={bundle.breadboardPreviewUrl}
								alt="Breadboard preview"
								style={{ maxWidth: "100%" }}
							/>
						) : null}
						<FileGroup title="Technical" files={bundle.technical} />
					</Stack>
				</Paper>
			) : null}
		</Stack>
	);
}
