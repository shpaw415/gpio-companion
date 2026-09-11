import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import FlashPanel from "../components/FlashPanel.tsx";
import GpioPanel from "../components/GpioPanel.tsx";
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
import {
	createProject,
	type GithubContent,
	type GithubRepo,
	getGithubApp,
	listProjects,
	loadProject,
	type ProjectBundle,
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
import { storageGet, storageSet } from "../lib/storage.ts";

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
	const colors = useColors();
	return (
		<Paper>
			{url ? (
				<Image
					source={{ uri: url }}
					style={{
						width: "100%",
						height: 180,
						backgroundColor: "#fff",
						borderRadius: 8,
					}}
					resizeMode="contain"
				/>
			) : (
				<Muted>{hint}</Muted>
			)}
			<Text style={{ color: colors.muted }}>{title}</Text>
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
		<Paper>
			<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
				<Body>{title}</Body>
				<Chip label={`${files.length}`} />
			</View>
			{files.length === 0 ? (
				<Muted>
					Nothing in this folder yet. The agent will push files here.
				</Muted>
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
	const activeBoard =
		boards.find((board) => board.device.uuid === selectedUuid) ?? boards[0];
	const activeUuid = activeBoard?.device.uuid ?? "";

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
		if (app?.connected || loading) {
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
			await openRepo(repo);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "failed to create project",
			);
		} finally {
			setCreating(false);
		}
	}

	async function openRepo(repo: GithubRepo) {
		if (!token) {
			return;
		}
		setError("");
		const key = CACHE_KEYS.projectBundle(repo.owner, repo.name);
		const hit = cache.peek<ProjectBundle>(key);
		if (hit.hit) {
			setBundle(hit.value);
			void storageSet(LAST_REPO_KEY, lastRepoKey(repo));
			return;
		}
		setOpening(true);
		try {
			const next = await cache.get(key, () =>
				loadProject(token, repo.owner, repo.name),
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

	return (
		<Screen>
			<Title>Project</Title>
			<Muted>
				Arduino studio: circuits, live pins, and flash. Only repos with a
				.gpio-companion file are listed.
			</Muted>
			{paired && activeUuid ? (
				<PrimaryButton label="Open Code" onPress={() => setTab("t3")} />
			) : null}
			{paired && activeUuid ? (
				<Paper>
					<Body>Board</Body>
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
					<Body>Live GPIO</Body>
					<Muted>
						Watch header pins from the board over the companion websocket. Tap a
						GPIO to drive it high or low.
					</Muted>
					<GpioPanel
						uuid={activeUuid}
						connected={Boolean(activeBoard?.status)}
						poll
					/>
					<Body>Flash Arduino</Body>
					<FlashPanel uuid={activeUuid} />
				</Paper>
			) : null}
			<ErrorText>{error || githubQuery.error || projectsQuery.error}</ErrorText>
			{loading ? (
				<>
					<Skeleton />
					<Skeleton />
				</>
			) : null}
			{loading || app?.connected ? null : (
				<Paper>
					<Body>Connect GitHub to see your bench</Body>
					<Muted>
						Install the gpio-companion GitHub App. The Pi pushes pcb/,
						breadboard/, and technical/ here. This page updates when the install
						finishes.
					</Muted>
					<PrimaryButton
						label="Connect GitHub App"
						disabled={!app?.installUrl}
						onPress={() => void Linking.openURL(app?.installUrl ?? "")}
					/>
					{paired ? null : (
						<Muted>Pair a board in Devices when you are ready.</Muted>
					)}
				</Paper>
			)}
			{loading || !configured ? null : (
				<Paper>
					<Field
						label="New project"
						value={createName}
						onChangeText={setCreateName}
						placeholder="blink-led"
					/>
					<PrimaryButton
						label={creating ? "Creating…" : "Create"}
						disabled={creating || !createName.trim()}
						onPress={() => void makeProject()}
					/>
					<Field
						label="Filter"
						value={query}
						onChangeText={setQuery}
						placeholder="Name or owner/repo"
					/>
					<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
						<Pressable
							onPress={() => setOwner("all")}
							style={{
								borderWidth: 1,
								borderColor: owner === "all" ? colors.primary : colors.border,
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
								All owners
							</Text>
						</Pressable>
						{owners.map((login) => (
							<Pressable
								key={login}
								onPress={() => setOwner(login)}
								style={{
									borderWidth: 1,
									borderColor: owner === login ? colors.primary : colors.border,
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
									label="GitHub"
									onPress={() => void Linking.openURL(repo.html_url)}
								/>
							</Pressable>
						);
					})}
					{filtered.length === 0 ? (
						<Muted>
							No gpio-companion projects yet. Create one here, or ask Code on
							the board — it writes a .gpio-companion file at the repo root.
						</Muted>
					) : null}
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
					<TextButton
						label="Open on GitHub"
						onPress={() =>
							void Linking.openURL(
								`https://github.com/${bundle.owner}/${bundle.repo}`,
							)
						}
					/>
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
					<FileGroup title="PCB" files={bundle.pcb} />
					<FileGroup title="Breadboard" files={bundle.breadboard} />
					<FileGroup title="Technical" files={bundle.technical} />
				</>
			) : loading || !configured ? null : (
				<Muted>Select a project to see the PCB and breadboard.</Muted>
			)}
		</Screen>
	);
}
