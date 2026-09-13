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
	type BoardSketch,
	createProject,
	type GithubContent,
	type GithubRepo,
	getGithubApp,
	listProjects,
	loadFlash,
	loadFlashSketches,
	loadProject,
	loadRun,
	loadRunSketches,
	openExternal,
	type ProjectBundle,
	pushProject,
	readProjectFile,
	startFlash,
	startRun,
} from "../api";
import {
	CACHE_KEYS,
	useApiCache,
	useCachedQuery,
	useUserBoards,
} from "../hooks/useApiCache";
import { useBoardSelection } from "../hooks/useBoardSelection";
import BreadboardViewer from "./BreadboardViewer";
import DebugLog from "./DebugLog";
import FlashPanel from "./FlashPanel";
import GpioPanel from "./GpioPanel";
import RunPanel from "./RunPanel";
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

function BoardSketchGroup({
	title,
	action,
	sketches,
	busy,
	onLaunch,
}: {
	title: string;
	action: string;
	sketches: BoardSketch[];
	busy: boolean;
	onLaunch: (dir: string) => void;
}) {
	return (
		<Paper sx={{ p: 2 }} elevation={1}>
			<Typography variant="subtitle1" sx={{ mb: 1 }}>
				{title}
			</Typography>
			{sketches.length === 0 ? (
				<Typography color="secondary" variant="body2">
					None on this board for this project.
				</Typography>
			) : (
				<Stack spacing={0.5}>
					{sketches.map((item) => (
						<Stack
							key={item.dir}
							direction="row"
							spacing={1}
							sx={{ alignItems: "center", justifyContent: "space-between" }}
						>
							<Typography variant="body2">{item.name}</Typography>
							<Button
								variant="outlined"
								size="small"
								disabled={busy}
								onClick={() => onLaunch(item.dir)}
							>
								{action}
							</Button>
						</Stack>
					))}
				</Stack>
			)}
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
			<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
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
	const { cache } = useApiCache();
	const githubQuery = useCachedQuery(CACHE_KEYS.githubApp, getGithubApp);
	const projectsQuery = useCachedQuery(CACHE_KEYS.projects, listProjects);
	const { boards, paired } = useUserBoards();
	const {
		uuid: selectedUuid,
		setUuid: selectBoard,
		openT3Pair,
	} = useBoardSelection();
	const app = githubQuery.data ?? null;
	const repos = projectsQuery.data?.repos ?? [];
	const configured = projectsQuery.data?.configured ?? false;
	const loading = githubQuery.loading || projectsQuery.loading;
	const [bundle, setBundle] = useState<ProjectBundle | null>(() => {
		try {
			const stored = window.localStorage.getItem(LAST_REPO_KEY) ?? "";
			if (!stored) {
				return null;
			}
			const slash = stored.indexOf("/");
			if (slash <= 0) {
				return null;
			}
			const hit = cache.peek<ProjectBundle>(
				CACHE_KEYS.projectBundle(
					stored.slice(0, slash),
					stored.slice(slash + 1),
				),
			);
			return hit.hit ? hit.value : null;
		} catch {
			return null;
		}
	});
	const [error, setError] = useState("");
	const [opening, setOpening] = useState(false);
	const [query, setQuery] = useState("");
	const [owner, setOwner] = useState("all");
	const [createName, setCreateName] = useState("");
	const [creating, setCreating] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saveHint, setSaveHint] = useState("");
	const [breadboardJson, setBreadboardJson] = useState<string | null>(null);
	const [hostSketches, setHostSketches] = useState<BoardSketch[]>([]);
	const [firmwareSketches, setFirmwareSketches] = useState<BoardSketch[]>([]);
	const [sketchBusy, setSketchBusy] = useState(false);
	const activeBoard =
		boards.find((board) => board.device.uuid === selectedUuid) ?? boards[0];
	const activeUuid = activeBoard?.device.uuid ?? "";

	useEffect(() => {
		if (!bundle) {
			setBreadboardJson(null);
			return;
		}
		const hasDiagram = bundle.breadboard.some(
			(file) =>
				file.name === "diagram.json" || file.path.endsWith("/diagram.json"),
		);
		const path = bundle.breadboardDiagramUrl
			? "breadboard/diagram.json"
			: bundle.breadboardCircuitJsonUrl
				? "breadboard/circuit.json"
				: hasDiagram
					? "breadboard/diagram.json"
					: null;
		if (!path) {
			setBreadboardJson(null);
			return;
		}
		let cancelled = false;
		void readProjectFile(bundle.owner, bundle.repo, path)
			.then((file) => {
				if (!cancelled) {
					setBreadboardJson(file.text);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setBreadboardJson(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [bundle]);

	useEffect(() => {
		void listProjects()
			.then((projects) => {
				projectsQuery.setData(projects);
			})
			.catch(() => undefined);
	}, [projectsQuery.setData]);

	useEffect(() => {
		if (app?.connected || loading) {
			return;
		}
		const timer = window.setInterval(() => {
			void Promise.all([getGithubApp(), listProjects()])
				.then(([github, projects]) => {
					githubQuery.setData(github);
					projectsQuery.setData(projects);
				})
				.catch(() => undefined);
		}, 2500);
		return () => window.clearInterval(timer);
	}, [app?.connected, loading, githubQuery.setData, projectsQuery.setData]);

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

	async function makeProject() {
		const name = createName.trim();
		if (!name || creating) {
			return;
		}
		setError("");
		setCreating(true);
		try {
			const repo = await createProject(name);
			projectsQuery.setData((current) => ({
				configured: true,
				repos: [repo, ...(current?.repos ?? [])],
			}));
			setCreateName("");
			await openRepo(repo);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to create project",
			);
		} finally {
			setCreating(false);
		}
	}

	async function saveFromBoard() {
		if (!bundle || !activeUuid || saving) {
			return;
		}
		setError("");
		setSaveHint("");
		setSaving(true);
		try {
			const result = await pushProject({
				uuid: activeUuid,
				owner: bundle.owner,
				name: bundle.repo,
			});
			const key = CACHE_KEYS.projectBundle(
				result.bundle.owner,
				result.bundle.repo,
			);
			cache.set(key, result.bundle);
			setBundle(result.bundle);
			setSaveHint(
				result.board.committed
					? "Saved and pushed from the board."
					: "Already up to date on GitHub.",
			);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to save project",
			);
		} finally {
			setSaving(false);
		}
	}

	async function openRepo(repo: GithubRepo) {
		setError("");
		setSaveHint("");
		const key = CACHE_KEYS.projectBundle(repo.owner, repo.name);
		const hit = cache.peek<ProjectBundle>(key);
		if (hit.hit) {
			setBundle(hit.value);
			try {
				window.localStorage.setItem(LAST_REPO_KEY, lastRepoKey(repo));
			} catch {
				return;
			}
			return;
		}
		setOpening(true);
		try {
			const next = await cache.get(key, () =>
				loadProject(repo.owner, repo.name),
			);
			setBundle(next);
			try {
				window.localStorage.setItem(LAST_REPO_KEY, lastRepoKey(repo));
			} catch {
				return;
			}
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to load project",
			);
		} finally {
			setOpening(false);
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: open last/first repo once the list is ready
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

	useEffect(() => {
		if (!activeUuid) {
			setHostSketches([]);
			setFirmwareSketches([]);
			return;
		}
		let cancelled = false;
		Promise.all([loadRunSketches(activeUuid), loadFlashSketches(activeUuid)])
			.then(([host, firmware]) => {
				if (cancelled) {
					return;
				}
				setHostSketches(host.sketches);
				setFirmwareSketches(firmware.sketches);
			})
			.catch(() => {
				if (cancelled) {
					return;
				}
				setHostSketches([]);
				setFirmwareSketches([]);
			});
		return () => {
			cancelled = true;
		};
	}, [activeUuid]);

	function launchSketch(task: () => Promise<void>) {
		setSketchBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setSketchBusy(false));
	}

	return (
		<Stack spacing={3}>
			<Stack
				direction="row"
				spacing={2}
				sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
			>
				<Stack spacing={0.5}>
					<Typography variant="h5" Element="h1">
						Project
					</Typography>
					<Typography color="secondary">
						Arduino studio: circuits, live pins, and flash. Only repos with a
						.gpio-companion file are listed.
					</Typography>
				</Stack>
				{paired && activeUuid ? (
					<Button
						variant="contained"
						onClick={() => openT3Pair(activeUuid, "")}
					>
						Open Code
					</Button>
				) : null}
			</Stack>
			{paired && activeUuid ? (
				<Paper sx={{ p: 2 }} elevation={1}>
					<Stack spacing={2}>
						<Select
							name="board"
							label="Board"
							value={activeUuid}
							onSelect={selectBoard}
						>
							{boards.map((board) => (
								<option key={board.device.uuid} value={board.device.uuid}>
									{board.device.label || board.device.uuid}
								</option>
							))}
						</Select>
						<Typography variant="h6">Live GPIO</Typography>
						<Typography color="secondary">
							Watch header pins and PWM from the board over the companion API
							websocket. Tap a GPIO to drive it high or low on that socket.
						</Typography>
						<GpioPanel
							uuid={activeUuid}
							connected={Boolean(activeBoard?.status)}
							poll
						/>
						<Typography variant="subtitle1">Flash Arduino</Typography>
						<FlashPanel uuid={activeUuid} project={bundle?.repo} />
						<Typography variant="subtitle1">Run on board</Typography>
						<RunPanel uuid={activeUuid} project={bundle?.repo} />
					</Stack>
				</Paper>
			) : null}
			{error || githubQuery.error || projectsQuery.error ? (
				<Alert severity="error">
					{error || githubQuery.error || projectsQuery.error}
				</Alert>
			) : null}
			{error || githubQuery.error || projectsQuery.error ? (
				<DebugLog error={error || githubQuery.error || projectsQuery.error} />
			) : null}

			{loading ? <ListSkeleton items={4} /> : null}

			{loading || app?.connected ? null : (
				<Paper sx={{ p: 4 }} elevation={1}>
					<Stack spacing={2}>
						<Typography variant="h6">
							Connect GitHub to see your bench
						</Typography>
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
								label="New project"
								placeholder="blink-led"
								value={createName}
								onChange={(event) => setCreateName(event.target.value)}
								sx={{ flex: 1, minWidth: 180 }}
							/>
							<Button
								variant="contained"
								disabled={creating || !createName.trim()}
								onClick={() => void makeProject()}
							>
								{creating ? "Creating…" : "Create"}
							</Button>
						</Stack>
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
								No gpio-companion projects yet. Create one here, or ask Code on
								the board — it writes a .gpio-companion file at the repo root.
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
						<Button
							variant="contained"
							size="small"
							disabled={saving || !activeUuid}
							onClick={() => void saveFromBoard()}
						>
							{saving ? "Saving…" : "Save to GitHub"}
						</Button>
					</Stack>
					{saveHint ? <Alert severity="success">{saveHint}</Alert> : null}
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
						<BreadboardViewer
							diagramText={breadboardJson}
							previewUrl={bundle.breadboardPreviewUrl}
							boardModel={activeBoard?.status?.model}
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
						<BoardSketchGroup
							title="Host sketches"
							action="Run"
							sketches={hostSketches.filter(
								(item) => item.project === bundle.repo,
							)}
							busy={sketchBusy || !activeUuid}
							onLaunch={(dir) => {
								launchSketch(async () => {
									await startRun({ uuid: activeUuid, dir });
									await loadRun(activeUuid);
								});
							}}
						/>
						<BoardSketchGroup
							title="Arduino firmware"
							action="Flash"
							sketches={firmwareSketches.filter(
								(item) => item.project === bundle.repo,
							)}
							busy={sketchBusy || !activeUuid}
							onLaunch={(dir) => {
								launchSketch(async () => {
									await startFlash({
										uuid: activeUuid,
										fqbn: "arduino:avr:uno",
										dir,
									});
									await loadFlash(activeUuid);
								});
							}}
						/>
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
