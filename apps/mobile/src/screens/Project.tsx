import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";
import FlashPanel from "../components/FlashPanel.tsx";
import TalkPanel from "../components/TalkPanel.tsx";
import GpioPanel from "../components/GpioPanel.tsx";
import RunPanel from "../components/RunPanel.tsx";
import {
	Body,
	Chip,
	ErrorText,
	Field,
	Muted,
	Paper,
	PrimaryButton,
	Screen,
	Skeleton,
	TextButton,
	Title,
} from "../components/ui.tsx";
import VerifyPanel from "../components/VerifyPanel.tsx";
import ZoomableImage from "../components/ZoomableImage.tsx";
import {
	type BoardSketch,
	createProject,
	deleteProject,
	type GithubContent,
	type GithubRepo,
	getGithubApp,
	listProjects,
	loadFlash,
	loadFlashSketches,
	loadProject,
	loadRun,
	loadRunSketches,
	type ProjectBundle,
	pushProject,
	type RunStatus,
	startFlash,
	startRun,
	stopRun,
} from "../lib/api.ts";
import {
	CACHE_KEYS,
	useApiCache,
	useCachedQuery,
	useUserBoards,
} from "../lib/api-cache.tsx";
import { useAuth } from "../lib/auth.tsx";
import { useBoardSelection } from "../lib/board-selection.tsx";
import { useColors } from "../lib/color-mode.tsx";
import { useDeviceHub } from "../lib/device-hub.tsx";
import { translateError, useT } from "../lib/locale.tsx";
import { storageGet, storageRemove, storageSet } from "../lib/storage.ts";
import { useDeviceHub as useRunHub } from "../lib/use-device-hub.ts";

const LAST_REPO_KEY = "gpio-companion-selected-project";

function lastRepoKey(repo: GithubRepo) {
	return `${repo.owner}/${repo.name}`;
}

function bundleReady(bundle: ProjectBundle): boolean {
	return Boolean(bundle.ref && bundle.branches);
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
	const colors = useColors();
	return (
		<Paper>
			{url ? <ZoomableImage title={title} uri={url} /> : <Muted>{hint}</Muted>}
			<Text style={{ color: colors.muted }}>{title}</Text>
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
	const t = useT();
	return (
		<Paper>
			<Body>{title}</Body>
			{sketches.length === 0 ? (
				<Muted>{t("project.noneOnBoard")}</Muted>
			) : (
				sketches.map((item) => (
					<View
						key={item.dir}
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<Body>{item.name}</Body>
						<TextButton
							label={action}
							disabled={busy}
							onPress={() => onLaunch(item.dir)}
						/>
					</View>
				))
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
	const t = useT();
	return (
		<Paper>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
				<Body>{title}</Body>
				<Chip label={`${files.length}`} />
			</View>
			{files.length === 0 ? (
				<Muted>{t("project.emptyFolder")}</Muted>
			) : (
				files.map((file) =>
					file.download_url ? (
						<TextButton
							key={file.path}
							label={file.path}
							onPress={() => void Linking.openURL(file.download_url ?? "")}
						/>
					) : (
						<Muted key={file.path}>{file.path}</Muted>
					),
				)
			)}
		</Paper>
	);
}

export default function Project() {
	const auth = useAuth();
	const t = useT();
	const colors = useColors();
	const token = auth.token;
	const { cache } = useApiCache();
	const githubQuery = useCachedQuery(CACHE_KEYS.githubApp, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return getGithubApp(token);
	});
	const projectsQuery = useCachedQuery(CACHE_KEYS.projects, () => {
		if (!token) {
			return Promise.reject(new Error("sign in first"));
		}
		return listProjects(token);
	});
	const { boards, paired } = useUserBoards();
	const { uuid: selectedUuid, setUuid: selectBoard } = useBoardSelection();
	const { setTab } = useDeviceHub();
	const app = githubQuery.data ?? null;
	const repos = projectsQuery.data?.repos ?? [];
	const configured = projectsQuery.data?.configured ?? false;
	const loading = githubQuery.loading || projectsQuery.loading;
	const [bundle, setBundle] = useState<ProjectBundle | null>(null);
	const [error, setError] = useState("");
	const [opening, setOpening] = useState(false);
	const [query, setQuery] = useState("");
	const [owner, setOwner] = useState("all");
	const [createName, setCreateName] = useState("");
	const [creating, setCreating] = useState(false);
	const [justCreated, setJustCreated] = useState("");
	const [boardToolsOpen, setBoardToolsOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saveHint, setSaveHint] = useState("");
	const [stopping, setStopping] = useState(false);
	const [runRunning, setRunRunning] = useState(false);
	const [hostSketches, setHostSketches] = useState<BoardSketch[]>([]);
	const [firmwareSketches, setFirmwareSketches] = useState<BoardSketch[]>([]);
	const [sketchBusy, setSketchBusy] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteName, setDeleteName] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<{
		owner: string;
		name: string;
	} | null>(null);
	const activeBoard =
		boards.find((board) => board.device.uuid === selectedUuid) ?? boards[0];
	const activeUuid = activeBoard?.device.uuid ?? "";

	useEffect(() => {
		if (!activeUuid || !token) {
			setHostSketches([]);
			setFirmwareSketches([]);
			setRunRunning(false);
			return;
		}
		let cancelled = false;
		Promise.all([
			loadRunSketches(token, activeUuid),
			loadFlashSketches(token, activeUuid),
		])
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
		loadRun(token, activeUuid)
			.then((status) => {
				if (!cancelled) {
					setRunRunning(status.running);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setRunRunning(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [activeUuid, token]);

	const onRun = useCallback((next: RunStatus) => {
		setRunRunning(next.running);
	}, []);
	useRunHub(activeUuid, token, { onRun });

	function launchSketch(task: () => Promise<void>) {
		setSketchBusy(true);
		setError("");
		void task()
			.catch((caught) => {
				setError(caught instanceof Error ? caught.message : "request failed");
			})
			.finally(() => setSketchBusy(false));
	}

	useFocusEffect(
		useCallback(() => {
			if (!token) {
				return;
			}
			void listProjects(token)
				.then((projects) => {
					projectsQuery.setData(projects);
				})
				.catch(() => undefined);
		}, [token, projectsQuery.setData]),
	);

	useEffect(() => {
		if ((app?.connected && app.canCreate) || loading) {
			return;
		}
		const timer = setInterval(() => {
			if (!token) {
				return;
			}
			void Promise.all([getGithubApp(token), listProjects(token)])
				.then(([github, projects]) => {
					githubQuery.setData(github);
					projectsQuery.setData(projects);
				})
				.catch(() => undefined);
		}, 2500);
		return () => clearInterval(timer);
	}, [
		app?.canCreate,
		app?.connected,
		loading,
		token,
		githubQuery.setData,
		projectsQuery.setData,
	]);

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
		if (!name || creating || !token) {
			return;
		}
		setError("");
		setCreating(true);
		try {
			const repo = await createProject(token, name);
			projectsQuery.setData((current) => ({
				configured: true,
				repos: [repo, ...(current?.repos ?? [])],
			}));
			setCreateName("");
			setJustCreated(repo.name);
			await openRepo(repo, true);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to create project",
			);
		} finally {
			setCreating(false);
		}
	}

	function openDelete(owner: string, name: string) {
		setPendingDelete({ owner, name });
		setDeleteName("");
		setDeleteOpen(true);
	}

	async function removeOpenedProject() {
		if (!token || !pendingDelete || deleting) {
			return;
		}
		if (deleteName.trim() !== pendingDelete.name) {
			return;
		}
		setError("");
		setDeleting(true);
		try {
			await deleteProject(token, pendingDelete.owner, pendingDelete.name);
			projectsQuery.setData((current) => ({
				configured: current?.configured ?? true,
				repos: (current?.repos ?? []).filter(
					(item) =>
						!(
							item.owner === pendingDelete.owner &&
							item.name === pendingDelete.name
						),
				),
			}));
			if (
				bundle?.owner === pendingDelete.owner &&
				bundle.repo === pendingDelete.name
			) {
				setBundle(null);
				void storageRemove(LAST_REPO_KEY);
			}
			setJustCreated("");
			setSaveHint("");
			setDeleteOpen(false);
			setDeleteName("");
			setPendingDelete(null);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to delete project",
			);
		} finally {
			setDeleting(false);
		}
	}

	async function stopSketch() {
		if (!token || !activeUuid || stopping) {
			return;
		}
		setError("");
		setStopping(true);
		try {
			await stopRun(token, activeUuid);
			setRunRunning((await loadRun(token, activeUuid)).running);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to stop sketch",
			);
		} finally {
			setStopping(false);
		}
	}

	async function saveFromBoard() {
		if (!bundle || !token || !activeUuid || saving) {
			return;
		}
		setError("");
		setSaveHint("");
		setSaving(true);
		try {
			const result = await pushProject(token, {
				uuid: activeUuid,
				owner: bundle.owner,
				name: bundle.repo,
			});
			cache.set(
				CACHE_KEYS.projectBundle(result.bundle.owner, result.bundle.repo),
				result.bundle,
			);
			if (result.bundle.ref) {
				cache.set(
					CACHE_KEYS.projectBundle(
						result.bundle.owner,
						result.bundle.repo,
						result.bundle.ref,
					),
					result.bundle,
				);
			}
			setBundle(result.bundle);
			setSaveHint(
				result.board.committed
					? t("project.savedPushed")
					: t("project.alreadyUpToDate"),
			);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to save project",
			);
		} finally {
			setSaving(false);
		}
	}

	async function selectBranch(ref: string) {
		if (!token || !bundle || !ref || ref === bundle.ref || opening) {
			return;
		}
		setError("");
		setSaveHint("");
		const key = CACHE_KEYS.projectBundle(bundle.owner, bundle.repo, ref);
		const hit = cache.peek<ProjectBundle>(key);
		if (hit.hit && bundleReady(hit.value)) {
			setBundle(hit.value);
			return;
		}
		setOpening(true);
		try {
			const next = await cache.get(key, () =>
				loadProject(token, bundle.owner, bundle.repo, ref),
			);
			setBundle(next);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to load branch",
			);
		} finally {
			setOpening(false);
		}
	}

	async function openRepo(repo: GithubRepo, created = false) {
		if (!token) {
			return;
		}
		if (!created) {
			setJustCreated("");
		}
		setError("");
		setSaveHint("");
		const key = CACHE_KEYS.projectBundle(repo.owner, repo.name);
		const hit = cache.peek<ProjectBundle>(key);
		if (hit.hit && bundleReady(hit.value)) {
			setBundle(hit.value);
			void storageSet(LAST_REPO_KEY, lastRepoKey(repo));
			return;
		}
		setOpening(true);
		try {
			const next = await cache.get(
				key,
				() => loadProject(token, repo.owner, repo.name),
				hit.hit,
			);
			setBundle(next);
			void storageSet(LAST_REPO_KEY, lastRepoKey(repo));
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
		void storageGet(LAST_REPO_KEY).then((stored) => {
			const match =
				repos.find((repo) => lastRepoKey(repo) === stored) ?? repos[0];
			if (match) {
				void openRepo(match);
			}
		});
	}, [loading, repos]);

	const selectedKey = bundle ? `${bundle.owner}/${bundle.repo}` : "";
	const empty = !loading && configured && repos.length === 0;
	const canCreate = app?.canCreate !== false;

	useEffect(() => {
		if (!bundle) {
			setBoardToolsOpen(false);
		}
	}, [bundle]);

	return (
		<Screen>
			{paired && activeUuid ? (
				<TextButton
					label={t("project.openCode")}
					onPress={() => setTab("t3")}
				/>
			) : null}
			<ErrorText>
				{translateError(
					t,
					error || githubQuery.error || projectsQuery.error || "",
				)}
			</ErrorText>
			{loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : null}
			{loading || app?.connected ? null : (
				<Paper>
					<Body>{t("project.connectGithubNative")}</Body>
					<Muted>{t("project.connectGithubNativeHint")}</Muted>
					<PrimaryButton
						label={t("github.connect")}
						disabled={!app?.installUrl}
						onPress={() => void Linking.openURL(app?.installUrl ?? "")}
					/>
					{paired ? null : <Muted>{t("project.pairWhenReady")}</Muted>}
				</Paper>
			)}
			{loading || !configured ? null : (
				<Paper>
					{canCreate ? (
						<>
							{empty ? (
								<>
									<Body>{t("project.createFirst")}</Body>
									<Muted>{t("project.createHint")}</Muted>
								</>
							) : null}
							<Field
								label={t("project.newProject")}
								value={createName}
								onChangeText={setCreateName}
								placeholder={t("project.placeholderName")}
							/>
							<PrimaryButton
								label={creating ? t("project.creating") : t("project.create")}
								disabled={creating || !createName.trim()}
								onPress={() => void makeProject()}
							/>
						</>
					) : (
						<>
							{empty ? <Body>{t("project.createFirst")}</Body> : null}
							<Muted>{t("project.authorizeHint")}</Muted>
							<PrimaryButton
								label={t("project.authorizeRepos")}
								disabled={!app?.installUrl}
								onPress={() => void Linking.openURL(app?.installUrl ?? "")}
							/>
						</>
					)}
					{empty ? null : (
						<>
							<Field
								label={t("project.filter")}
								value={query}
								onChangeText={setQuery}
								placeholder={t("project.filterPlaceholder")}
							/>
							<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
								<Pressable
									onPress={() => setOwner("all")}
									style={{
										borderWidth: 1,
										borderColor:
											owner === "all" ? colors.primary : colors.border,
										borderRadius: 999,
										paddingHorizontal: 10,
										paddingVertical: 6,
									}}
								>
									<Text
										style={{
											color: owner === "all" ? colors.primary : colors.text,
										}}
									>
										{t("project.allOwners")}
									</Text>
								</Pressable>
								{owners.map((login) => (
									<Pressable
										key={login}
										onPress={() => setOwner(login)}
										style={{
											borderWidth: 1,
											borderColor:
												owner === login ? colors.primary : colors.border,
											borderRadius: 999,
											paddingHorizontal: 10,
											paddingVertical: 6,
										}}
									>
										<Text
											style={{
												color: owner === login ? colors.primary : colors.text,
											}}
										>
											{login}
										</Text>
									</Pressable>
								))}
							</View>
							{filtered.map((repo) => {
								const key = lastRepoKey(repo);
								const selected = selectedKey === key;
								return (
									<Pressable
										key={key}
										onPress={() => void openRepo(repo)}
										style={{
											paddingVertical: 10,
											borderBottomWidth: 1,
											borderBottomColor: colors.border,
										}}
									>
										<Text
											style={{
												color: selected ? colors.primary : colors.text,
												fontWeight: selected ? "700" : "500",
											}}
										>
											{repo.name}
										</Text>
										<Muted>{repo.owner}</Muted>
										<TextButton
											label={t("nav.github")}
											onPress={() => void Linking.openURL(repo.html_url)}
										/>
										<TextButton
											label={t("project.delete")}
											danger
											onPress={() => openDelete(repo.owner, repo.name)}
										/>
									</Pressable>
								);
							})}
							{filtered.length === 0 ? (
								<Muted>{t("project.noMatch")}</Muted>
							) : null}
						</>
					)}
				</Paper>
			)}
			{opening ? (
				<>
					<Skeleton height={180} />
					<Skeleton height={180} />
				</>
			) : bundle ? (
				<>
					<Body>
						{bundle.owner}/{bundle.repo}
					</Body>
					{paired && activeUuid ? (
						<TalkPanel
							uuid={activeUuid}
							repo={bundle.repo}
							owner={bundle.owner}
						/>
					) : null}
					{bundle.branches && bundle.branches.length > 0 ? (
						<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
							{bundle.branches.map((branch) => {
								const selected = branch.name === bundle.ref;
								const label =
									branch.name === bundle.defaultBranch
										? t("project.defaultBranch", { name: branch.name })
										: branch.name;
								return (
									<Pressable
										key={branch.name}
										onPress={() => void selectBranch(branch.name)}
										style={{
											borderWidth: 1,
											borderColor: selected ? colors.primary : colors.border,
											borderRadius: 999,
											paddingHorizontal: 10,
											paddingVertical: 6,
										}}
									>
										<Text
											style={{
												color: selected ? colors.primary : colors.text,
											}}
										>
											{label}
										</Text>
									</Pressable>
								);
							})}
						</View>
					) : null}
					<TextButton
						label={t("project.openOnGithub")}
						onPress={() =>
							void Linking.openURL(
								`https://github.com/${bundle.owner}/${bundle.repo}`,
							)
						}
					/>
					<TextButton
						label={stopping ? t("project.stopping") : t("project.stopSketch")}
						danger={runRunning}
						disabled={stopping || !activeUuid}
						onPress={() => void stopSketch()}
					/>
					<PrimaryButton
						label={saving ? t("project.saving") : t("project.saveToGithub")}
						disabled={saving || !activeUuid}
						onPress={() => void saveFromBoard()}
					/>
					<TextButton
						label={t("project.delete")}
						danger
						disabled={deleting}
						onPress={() => openDelete(bundle.owner, bundle.repo)}
					/>
					{justCreated === bundle.repo ? (
						<Paper>
							<Body>{t("project.readyChat", { repo: bundle.repo })}</Body>
							{paired && activeUuid ? (
								<PrimaryButton
									label={t("project.openCode")}
									onPress={() => setTab("t3")}
								/>
							) : (
								<Muted>{t("project.pairSoCodeOpens")}</Muted>
							)}
						</Paper>
					) : null}
					{saveHint ? <Muted>{saveHint}</Muted> : null}
					<PreviewCard
						title={t("project.pcb")}
						hint={t("project.noPcbHintDesktop")}
						url={bundle.pcbPreviewUrl}
					/>
					<PreviewCard
						title={t("project.breadboard")}
						hint={t("project.noBreadboardPreview")}
						url={bundle.breadboardPreviewUrl}
					/>
					<FileGroup title={t("project.pcb")} files={bundle.pcb} />
					<FileGroup
						title={t("project.breadboard")}
						files={bundle.breadboard}
					/>
					<FileGroup title={t("project.technical")} files={bundle.technical} />
					<BoardSketchGroup
						title={t("project.hostSketches")}
						action={t("project.run")}
						sketches={hostSketches.filter(
							(item) => item.project === bundle.repo,
						)}
						busy={sketchBusy || !token || !activeUuid}
						onLaunch={(dir) => {
							if (!token) {
								return;
							}
							launchSketch(async () => {
								await startRun(token, { uuid: activeUuid, dir });
								setRunRunning((await loadRun(token, activeUuid)).running);
							});
						}}
					/>
					<BoardSketchGroup
						title={t("project.arduinoFirmware")}
						action={t("flash.flash")}
						sketches={firmwareSketches.filter(
							(item) => item.project === bundle.repo,
						)}
						busy={sketchBusy || !token || !activeUuid}
						onLaunch={(dir) => {
							if (!token) {
								return;
							}
							launchSketch(async () => {
								await startFlash(token, {
									uuid: activeUuid,
									fqbn: "arduino:avr:uno",
									dir,
								});
								await loadFlash(token, activeUuid);
							});
						}}
					/>
				</>
			) : loading || !configured || empty ? null : (
				<Muted>{t("project.selectToSee")}</Muted>
			)}
			{paired && activeUuid && bundle ? (
				<Paper>
					<Body>{t("project.boardTools")}</Body>
					<TextButton
						label={boardToolsOpen ? t("project.hide") : t("project.show")}
						onPress={() => setBoardToolsOpen((open) => !open)}
					/>
					{boardToolsOpen ? (
						<>
							<Body>{t("docs.board")}</Body>
							<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
								{boards.map((board) => (
									<Pressable
										key={board.device.uuid}
										onPress={() => selectBoard(board.device.uuid)}
										style={{
											borderWidth: 1,
											borderColor:
												activeUuid === board.device.uuid
													? colors.primary
													: colors.border,
											borderRadius: 999,
											paddingHorizontal: 10,
											paddingVertical: 6,
										}}
									>
										<Text
											style={{
												color:
													activeUuid === board.device.uuid
														? colors.primary
														: colors.text,
											}}
										>
											{board.device.label || board.device.uuid.slice(0, 8)}
										</Text>
									</Pressable>
								))}
							</View>
							<Body>{t("gpio.live")}</Body>
							<Muted>{t("project.liveGpioHint")}</Muted>
							<GpioPanel
								uuid={activeUuid}
								connected={Boolean(activeBoard?.status)}
								poll
							/>
							<Body>{t("flash.title")}</Body>
							<FlashPanel uuid={activeUuid} project={bundle.repo} />
							<Body>{t("run.title")}</Body>
							<RunPanel uuid={activeUuid} project={bundle.repo} />
							<VerifyPanel uuid={activeUuid} project={bundle.repo} />
						</>
					) : null}
				</Paper>
			) : null}
			<Modal
				visible={deleteOpen}
				animationType="fade"
				transparent
				onRequestClose={() => {
					if (!deleting) {
						setDeleteOpen(false);
					}
				}}
			>
				<View
					style={{
						flex: 1,
						backgroundColor: "rgba(0,0,0,0.5)",
						justifyContent: "center",
						padding: 24,
					}}
				>
					<View
						style={{
							backgroundColor: colors.surface,
							borderRadius: 16,
							padding: 16,
							gap: 12,
						}}
					>
						<Title>{t("project.deleteTitle")}</Title>
						<Body>
							{t("project.deleteConfirmHint", {
								name: pendingDelete?.name ?? "",
							})}
						</Body>
						<Field
							label={t("project.colName")}
							value={deleteName}
							onChangeText={setDeleteName}
							placeholder={pendingDelete?.name}
						/>
						<PrimaryButton
							label={
								deleting ? t("project.deleting") : t("project.deleteConfirm")
							}
							disabled={
								deleting ||
								!pendingDelete ||
								deleteName.trim() !== pendingDelete.name
							}
							onPress={() => void removeOpenedProject()}
						/>
						<TextButton
							label={t("project.cancel")}
							disabled={deleting}
							onPress={() => setDeleteOpen(false)}
						/>
					</View>
				</View>
			</Modal>
		</Screen>
	);
}
