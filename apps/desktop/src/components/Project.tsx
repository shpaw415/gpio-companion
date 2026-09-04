import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
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
import {
	getGithubApp,
	type GithubAppStatus,
	type GithubContent,
	type GithubRepo,
	listDevices,
	listProjects,
	loadProject,
	openExternal,
	type ProjectBundle,
} from "../api";
import DebugLog from "./DebugLog";
import { ListSkeleton, PreviewSkeleton } from "./skeletons";

const LAST_REPO_KEY = "gpio-companion-selected-project";

function lastRepoKey(repo: GithubRepo) {
	return `${repo.owner}/${repo.name}`;
}

function PreviewCard({
	title,
	hint,
	url,
}: {
	title: string;
	hint: string;
	url: string | null;
}) {
	return (
		<Paper sx={{ overflow: "hidden", minHeight: 220 }} elevation={1}>
			{url ? (
				<img
					src={url}
					alt={`${title} preview`}
					style={{
						display: "block",
						width: "100%",
						maxHeight: 360,
						objectFit: "contain",
						background: "#fff",
					}}
				/>
			) : (
				<Stack
					sx={{
						minHeight: 220,
						alignItems: "center",
						justifyContent: "center",
						px: 3,
					}}
				>
					<Typography color="secondary" align="center">
						{hint}
					</Typography>
				</Stack>
			)}
			<Typography color="secondary" sx={{ px: 2, py: 1.5 }}>
				{title}
			</Typography>
		</Paper>
	);
}

function FileGroup({
	title,
	files,
}: {
	title: string;
	files: GithubContent[];
}) {
	return (
		<Paper sx={{ p: 2 }} elevation={1}>
			<Stack
				direction="row"
				spacing={1}
				sx={{ alignItems: "center", mb: 1 }}
			>
				<Typography variant="subtitle1">{title}</Typography>
				<Chip label={`${files.length}`} size="small" variant="outlined" />
			</Stack>
			{files.length === 0 ? (
				<Typography color="secondary" variant="body2">
					Nothing in this folder yet. The agent will push files here.
				</Typography>
			) : (
				<Stack spacing={0.5}>
					{files.map((file) =>
						file.download_url ? (
							<Button
								key={file.path}
								variant="text"
								size="small"
								sx={{ justifyContent: "flex-start", wordBreak: "break-all" }}
								onClick={() => void openExternal(file.download_url ?? "")}
							>
								{file.path}
							</Button>
						) : (
							<Typography key={file.path} variant="body2" color="secondary">
								{file.path}
							</Typography>
						),
					)}
				</Stack>
			)}
		</Paper>
	);
}

export default function Project() {
	const [app, setApp] = useState<GithubAppStatus | null>(null);
	const [repos, setRepos] = useState<GithubRepo[]>([]);
	const [configured, setConfigured] = useState(false);
	const [paired, setPaired] = useState(false);
	const [bundle, setBundle] = useState<ProjectBundle | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const [opening, setOpening] = useState(false);
	const [query, setQuery] = useState("");
	const [owner, setOwner] = useState("all");

	useEffect(() => {
		let cancelled = false;
		void Promise.all([getGithubApp(), listProjects(), listDevices()])
			.then(([github, projects, devices]) => {
				if (cancelled) {
					return;
				}
				setApp(github);
				setConfigured(projects.configured);
				setRepos(projects.repos);
				setPaired(devices.devices.length > 0);
			})
			.catch((caught) => {
				if (!cancelled) {
					setError(caught instanceof Error ? caught.message : "load failed");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (app?.connected || loading) {
			return;
		}
		const timer = window.setInterval(() => {
			void Promise.all([getGithubApp(), listProjects()])
				.then(([github, projects]) => {
					setApp(github);
					setConfigured(projects.configured);
					setRepos(projects.repos);
				})
				.catch(() => undefined);
		}, 2500);
		return () => window.clearInterval(timer);
	}, [app?.connected, loading]);

	const owners = useMemo(
		() => [...new Set(repos.map((repo) => repo.owner))].sort(),
		[repos],
	);

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

	async function openRepo(repo: GithubRepo) {
		setError("");
		setOpening(true);
		try {
			const next = await loadProject(repo.owner, repo.name);
			setBundle(next);
			try {
				window.localStorage.setItem(LAST_REPO_KEY, lastRepoKey(repo));
			} catch {
				return;
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "failed to load project");
		} finally {
			setOpening(false);
		}
	}

	useEffect(() => {
		if (loading || bundle || repos.length === 0) {
			return;
		}
		let stored = "";
		try {
			stored = window.localStorage.getItem(LAST_REPO_KEY) ?? "";
		} catch {
			stored = "";
		}
		const match =
			repos.find((repo) => lastRepoKey(repo) === stored) ?? repos[0];
		if (match) {
			void openRepo(match);
		}
		// open the last (or first) repo once the list is ready
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading, repos]);

	const selectedKey = bundle ? `${bundle.owner}/${bundle.repo}` : "";

	return (
		<Stack spacing={3}>
			<Stack spacing={0.5}>
				<Typography variant="h5" Element="h1">
					Project
				</Typography>
				<Typography color="secondary">
					PCB, breadboard, and technical files the on-device agent pushed to
					GitHub. Pick a repo to see the board.
				</Typography>
			</Stack>
			{error ? <Alert severity="error">{error}</Alert> : null}
			{error ? <DebugLog error={error} /> : null}

			{loading ? <ListSkeleton items={4} /> : null}

			{loading || app?.connected ? null : (
				<Paper sx={{ p: 4 }} elevation={1}>
					<Stack spacing={2}>
						<Typography variant="h6">Connect GitHub to see your bench</Typography>
						<Typography color="secondary">
							Install the gpio-companion GitHub App. The Pi pushes pcb/,
							breadboard/, and technical/ here. This page updates when the
							install finishes.
						</Typography>
						<Stack direction="row" spacing={1}>
							<Button
								variant="contained"
								disabled={!app?.installUrl}
								onClick={() => void openExternal(app?.installUrl ?? "")}
							>
								Connect GitHub App
							</Button>
							{!paired ? (
								<Typography color="secondary" sx={{ alignSelf: "center" }}>
									Pair a board in Devices when you are ready.
								</Typography>
							) : null}
						</Stack>
					</Stack>
				</Paper>
			)}

			{loading || !configured ? null : (
				<Paper sx={{ p: 2 }} elevation={1}>
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
								onChange={(event) => setQuery(event.target.value)}
								sx={{ flex: 1, minWidth: 220 }}
							/>
							<Select
								name="owner"
								label="Owner"
								value={owner}
								onSelect={setOwner}
								sx={{ minWidth: 180 }}
							>
								{[
									<option key="all" value="all">
										All owners
									</option>,
									...owners.map((login) => (
										<option key={login} value={login}>
											{login}
										</option>
									)),
								]}
							</Select>
						</Stack>
						<TableContainer>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Name</TableCell>
										<TableCell>Owner</TableCell>
										<TableCell />
									</TableRow>
								</TableHead>
								<TableBody>
									{filtered.map((repo) => {
										const key = lastRepoKey(repo);
										return (
											<TableRow
												key={key}
												hover
												selected={selectedKey === key}
												onClick={() => void openRepo(repo)}
												sx={{ cursor: "pointer" }}
											>
												<TableCell>{repo.name}</TableCell>
												<TableCell>{repo.owner}</TableCell>
												<TableCell>
													<Button
														variant="text"
														size="small"
														onClick={(event) => {
															event.stopPropagation();
															void openExternal(repo.html_url);
														}}
													>
														GitHub
													</Button>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</TableContainer>
						{filtered.length === 0 ? (
							<Typography color="secondary">
								No matching repos. The agent creates them when it pushes.
							</Typography>
						) : null}
					</Stack>
				</Paper>
			)}

			{opening ? (
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: "1fr 1fr",
						gap: 2,
					}}
				>
					<PreviewSkeleton height={220} />
					<PreviewSkeleton height={220} />
				</Box>
			) : bundle ? (
				<Stack spacing={2}>
					<Stack
						direction="row"
						spacing={1}
						sx={{ alignItems: "center", flexWrap: "wrap" }}
					>
						<Typography variant="h6">
							{bundle.owner}/{bundle.repo}
						</Typography>
						<Button
							variant="text"
							size="small"
							onClick={() =>
								void openExternal(
									`https://github.com/${bundle.owner}/${bundle.repo}`,
								)
							}
						>
							Open on GitHub
						</Button>
					</Stack>
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: 2,
						}}
					>
						<PreviewCard
							title="PCB"
							hint="No pcb/preview.svg yet. Ask the agent to design a PCB."
							url={bundle.pcbPreviewUrl}
						/>
						<PreviewCard
							title="Breadboard"
							hint="No breadboard/preview.svg yet. Ask the agent to wire a breadboard."
							url={bundle.breadboardPreviewUrl}
						/>
					</Box>
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: 2,
						}}
					>
						<FileGroup title="PCB" files={bundle.pcb} />
						<FileGroup title="Breadboard" files={bundle.breadboard} />
						<FileGroup title="Technical" files={bundle.technical} />
					</Box>
				</Stack>
			) : loading || !configured ? null : (
				<Paper sx={{ p: 4 }} elevation={0}>
					<Typography color="secondary" align="center">
						Select a project to see the PCB and breadboard.
					</Typography>
				</Paper>
			)}
		</Stack>
	);
}
