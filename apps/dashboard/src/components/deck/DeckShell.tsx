import AccountCircleIcon from "@material-design-icons/svg/filled/account_circle.svg";
import BoltIcon from "@material-design-icons/svg/filled/bolt.svg";
import BuildIcon from "@material-design-icons/svg/filled/build.svg";
import CloseIcon from "@material-design-icons/svg/filled/close.svg";
import DarkModeIcon from "@material-design-icons/svg/filled/dark_mode.svg";
import FolderIcon from "@material-design-icons/svg/filled/folder.svg";
import LightModeIcon from "@material-design-icons/svg/filled/light_mode.svg";
import MemoryIcon from "@material-design-icons/svg/filled/memory.svg";
import MenuIcon from "@material-design-icons/svg/filled/menu.svg";
import SearchIcon from "@material-design-icons/svg/filled/search.svg";
import TerminalIcon from "@material-design-icons/svg/filled/terminal.svg";
import WarningIcon from "@material-design-icons/svg/filled/warning.svg";
import { navigate } from "@next/client";
import BottomNavigation, {
	BottomNavigationAction,
} from "@shpaw415/mui-lite/BottomNavigation";
import IconButton from "@shpaw415/mui-lite/IconButton";
import Paper from "@shpaw415/mui-lite/Paper";
import type {
	ComponentType,
	ReactNode,
	PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";
import { useColorMode } from "../../hooks/useColorMode.tsx";
import { useDashboardMode } from "../../hooks/useDashboardMode.tsx";
import { useT } from "../../hooks/useLocale.tsx";
import useMobile from "../../hooks/useMobile.ts";
import { usePathname } from "../../hooks/usePathname.tsx";
import { isAdmin } from "../../lib/auth/role.ts";
import {
	deviceTabs,
	PROFILE_TABS,
	type SectionTab,
} from "../../lib/dashboard-mode.ts";
import { DASHBOARD_BOTTOM_NAV_ID } from "../../lib/t3-url.ts";

type DeckTranslate = (key: `deck.${string}`) => string;
type FocusRegion = "primary" | "secondary";
type DockTab = "console" | "gpio" | "flash" | "problems";
type ContextLink = {
	href: string;
	labelKey: `deck.${string}`;
};

const DOCK_TABS: Array<[DockTab, ComponentType]> = [
	["console", TerminalIcon],
	["gpio", BoltIcon],
	["flash", BuildIcon],
	["problems", WarningIcon],
];

const DOCK_STORAGE_KEY = "b6-dockH";
const DEFAULT_DOCK_HEIGHT = 150;

function sectionFor(pathname: string): "/project" | "/devices" | "/profile" {
	if (pathname.startsWith("/devices")) return "/devices";
	if (pathname.startsWith("/profile")) return "/profile";
	return "/project";
}

function selectedHref(pathname: string, links: ContextLink[]): string {
	return (
		[...links]
			.sort((a, b) => b.href.length - a.href.length)
			.find(
				(link) =>
					pathname === link.href || pathname.startsWith(`${link.href}/`),
			)?.href ??
		links[0]?.href ??
		""
	);
}

function readDockHeight(): number {
	if (typeof window === "undefined") return DEFAULT_DOCK_HEIGHT;
	const raw = window.localStorage.getItem(DOCK_STORAGE_KEY);
	if (!raw) return DEFAULT_DOCK_HEIGHT;
	const stored = Number(raw);
	return Number.isFinite(stored)
		? Math.min(480, Math.max(64, stored))
		: DEFAULT_DOCK_HEIGHT;
}

function deckLink(link: SectionTab): ContextLink {
	return {
		href: link.href,
		labelKey: `deck.link.${link.labelKey.slice("nav.".length)}`,
	};
}

export default function DeckShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const t = useT() as unknown as DeckTranslate;
	const tAny = t as unknown as (
		key: string,
		vars?: Record<string, string | number>,
	) => string;
	const session = useAuthSession();
	const { uuid: selectedBoardUuid } = useBoardSelection();
	const mobile = useMobile();
	const { isDark, toggleMode: toggleTheme } = useColorMode();
	const { mode, setMode } = useDashboardMode();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [focusRegion, setFocusRegion] = useState<FocusRegion>("primary");
	const [dockTab, setDockTab] = useState<DockTab>("console");
	const [dockHeight, setDockHeight] = useState(readDockHeight);
	const primaryRef = useRef<HTMLElement>(null);
	const secondaryRef = useRef<HTMLElement>(null);
	const paletteInputRef = useRef<HTMLInputElement>(null);
	const dragRef = useRef<{ y: number; height: number } | null>(null);
	const section = sectionFor(pathname);

	const rail = [
		{ href: "/project", label: t("deck.rail.work"), icon: <FolderIcon /> },
		{ href: "/devices", label: t("deck.rail.fleet"), icon: <MemoryIcon /> },
		{ href: "/devices/t3", label: t("deck.rail.t3"), icon: <TerminalIcon /> },
		{
			href: "/profile",
			label: t("deck.rail.you"),
			icon: <AccountCircleIcon />,
		},
	];
	const bottomNavigation = [
		{
			href: "/project",
			label: t("deck.bottom.project"),
			icon: <FolderIcon />,
		},
		{
			href: "/devices",
			label: t("deck.bottom.devices"),
			icon: <MemoryIcon />,
		},
		{
			href: "/profile",
			label: t("deck.bottom.profile"),
			icon: <AccountCircleIcon />,
		},
	];
	const workLinks: ContextLink[] = [
		{ href: "/project", labelKey: "deck.link.project" },
		{ href: "/devices/t3", labelKey: "deck.link.code" },
		{ href: "/devices/docs", labelKey: "deck.link.learn" },
	];
	const contextLinks: ContextLink[] = pathname.startsWith("/profile")
		? PROFILE_TABS.map(deckLink)
		: pathname.startsWith("/devices")
			? deviceTabs(mode, isAdmin(session.data?.role)).map(deckLink)
			: workLinks;
	const contextTitle = pathname.startsWith("/profile")
		? t("deck.context.you")
		: pathname.startsWith("/devices")
			? t("deck.context.fleet")
			: t("deck.context.work");
	const activeContext = selectedHref(pathname, contextLinks);
	const secondaryHint = pathname.startsWith("/profile")
		? t("deck.secondary.profile")
		: pathname.startsWith("/devices")
			? t("deck.secondary.devices")
			: t("deck.secondary.project");
	const admin = isAdmin(session.data?.role);
	const allNavLinks: ContextLink[] = [
		...workLinks,
		...deviceTabs(mode, admin).map(deckLink),
		...PROFILE_TABS.map(deckLink),
	];
	const seenHrefs = new Set<string>();
	const paletteNav = allNavLinks.filter((item) => {
		if (seenHrefs.has(item.href)) return false;
		seenHrefs.add(item.href);
		return true;
	});
	const boardActions = [
		{
			name: tAny("project.run"),
			hint: t("deck.secondary.project"),
			run: () => navigate("/project"),
		},
		{
			name: tAny("flash.flash"),
			hint: t("deck.secondary.project"),
			run: () => navigate("/project"),
		},
		{
			name: tAny("verify.verify"),
			hint: t("deck.secondary.project"),
			run: () => navigate("/project"),
		},
		{
			name: tAny("project.saveToGithub"),
			hint: t("deck.secondary.project"),
			run: () => navigate("/project"),
		},
		{
			name: tAny("credits.add"),
			hint: t("deck.secondary.profile"),
			run: () => navigate("/profile/credits"),
		},
	];
	const commands = [
		...rail.map((item) => ({
			name: item.label,
			hint: t("deck.command.navigate"),
			run: () => navigate(item.href),
		})),
		...paletteNav
			.filter((item) => !rail.some((railItem) => railItem.href === item.href))
			.map((item) => ({
				name: t(item.labelKey),
				hint: contextTitle,
				run: () => navigate(item.href),
			})),
		...boardActions,
		{
			name: t("deck.command.easy"),
			hint: t("deck.command.mode"),
			run: () => setMode("easy"),
		},
		{
			name: t("deck.command.expert"),
			hint: t("deck.command.mode"),
			run: () => setMode("expert"),
		},
		{
			name: t("deck.command.theme"),
			hint: t("deck.command.appearance"),
			run: toggleTheme,
		},
	];
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const filteredCommands = commands.filter((command) =>
		`${command.name} ${command.hint}`
			.toLocaleLowerCase()
			.includes(normalizedQuery),
	);

	useEffect(() => {
		if (!pathname) return;
		setDrawerOpen(false);
		setPaletteOpen(false);
		setQuery("");
	}, [pathname]);

	useEffect(() => {
		if (paletteOpen) paletteInputRef.current?.focus();
	}, [paletteOpen]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setPaletteOpen((open) => !open);
				return;
			}
			if (event.key === "Escape") {
				setPaletteOpen(false);
				setDrawerOpen(false);
				return;
			}
			if ((event.metaKey || event.ctrlKey) && event.key === "1") {
				event.preventDefault();
				setFocusRegion("primary");
				primaryRef.current?.focus();
			}
			if ((event.metaKey || event.ctrlKey) && event.key === "2") {
				event.preventDefault();
				setFocusRegion("secondary");
				secondaryRef.current?.focus();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	useEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			if (!dragRef.current) return;
			const next = Math.min(
				480,
				Math.max(
					64,
					dragRef.current.height + dragRef.current.y - event.clientY,
				),
			);
			setDockHeight(next);
		};
		const onPointerUp = () => {
			if (!dragRef.current) return;
			dragRef.current = null;
			window.localStorage.setItem(DOCK_STORAGE_KEY, String(dockHeight));
		};
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [dockHeight]);

	useEffect(() => {
		if (mode === "easy" && dockTab === "problems") setDockTab("console");
	}, [dockTab, mode]);

	function runCommand(command: (typeof commands)[number] | undefined) {
		if (!command) return;
		command.run();
		setPaletteOpen(false);
		setQuery("");
	}

	function beginDockDrag(event: ReactPointerEvent<HTMLDivElement>) {
		event.preventDefault();
		dragRef.current = { y: event.clientY, height: dockHeight };
	}

	return (
		<div className="b6-deck">
			<header className="b6-topbar">
				<IconButton
					className="b6-drawer-trigger"
					size="small"
					aria-label={t("deck.action.openNavigation")}
					onClick={() => setDrawerOpen(true)}
				>
					<MenuIcon />
				</IconButton>
				<a className="b6-brand" href="/project">
					<img src="/static/logo.png" alt="" width={24} height={24} />
					<span>{t("deck.brand")}</span>
				</a>
				<button
					type="button"
					className="b6-palette-trigger"
					onClick={() => setPaletteOpen(true)}
				>
					<SearchIcon />
					<span>{t("deck.command.open")}</span>
					<kbd>{t("deck.command.shortcut")}</kbd>
				</button>
				<fieldset className="b6-mode-switch">
					<legend>{t("deck.mode.label")}</legend>
					<button
						type="button"
						className={mode === "easy" ? "is-active" : undefined}
						aria-pressed={mode === "easy"}
						onClick={() => setMode("easy")}
					>
						{t("deck.mode.easy")}
					</button>
					<button
						type="button"
						className={mode === "expert" ? "is-active" : undefined}
						aria-pressed={mode === "expert"}
						onClick={() => setMode("expert")}
					>
						{t("deck.mode.expert")}
					</button>
				</fieldset>
				<IconButton
					size="small"
					aria-label={isDark ? t("deck.theme.toLight") : t("deck.theme.toDark")}
					onClick={toggleTheme}
				>
					{isDark ? <LightModeIcon /> : <DarkModeIcon />}
				</IconButton>
			</header>

			<div className="b6-body">
				<nav className="b6-rail" aria-label={t("deck.rail.label")}>
					{rail.map((item) => {
						const active =
							item.href === "/devices/t3"
								? pathname.startsWith(item.href)
								: section === item.href && !pathname.startsWith("/devices/t3");
						return (
							<a
								key={item.href}
								href={item.href}
								className={active ? "is-active" : undefined}
								aria-current={active ? "page" : undefined}
							>
								{item.icon}
								<span>{item.label}</span>
							</a>
						);
					})}
				</nav>

				{drawerOpen ? (
					<button
						type="button"
						className="b6-scrim"
						aria-label={t("deck.action.closeNavigation")}
						onClick={() => setDrawerOpen(false)}
					/>
				) : null}
				<aside className={`b6-context ${drawerOpen ? "is-open" : ""}`}>
					<div className="b6-context-heading">
						<div>
							<span>{t("deck.context.eyebrow")}</span>
							<strong>{contextTitle}</strong>
						</div>
						<IconButton
							className="b6-drawer-close"
							size="small"
							aria-label={t("deck.action.closeNavigation")}
							onClick={() => setDrawerOpen(false)}
						>
							<CloseIcon />
						</IconButton>
					</div>
					<nav aria-label={t("deck.context.label")}>
						{contextLinks.map((item) => (
							<a
								key={item.href}
								href={item.href}
								className={
									activeContext === item.href ? "is-active" : undefined
								}
								aria-current={activeContext === item.href ? "page" : undefined}
							>
								{t(item.labelKey)}
							</a>
						))}
					</nav>
					<div className="b6-focus-hint">{t("deck.focus.contextHint")}</div>
				</aside>

				<div className="b6-workspace">
					<main className="b6-stage">
						<section
							ref={primaryRef}
							tabIndex={-1}
							aria-label={t("deck.focus.primary")}
							className={`b6-stage-primary ${focusRegion === "primary" ? "is-focused" : ""}`}
							onClick={() => setFocusRegion("primary")}
							onKeyDown={() => setFocusRegion("primary")}
						>
							<div className="b6-stage-content">{children}</div>
						</section>
						<aside
							ref={secondaryRef}
							tabIndex={-1}
							aria-label={t("deck.focus.secondary")}
							className={`b6-stage-secondary ${focusRegion === "secondary" ? "is-focused" : ""}`}
							onClick={() => setFocusRegion("secondary")}
							onKeyDown={() => setFocusRegion("secondary")}
						>
							<strong>{t("deck.secondary.title")}</strong>
							<span>{secondaryHint}</span>
							<span>
								{selectedBoardUuid
									? tAny("deck.status.board", {
											uuid: selectedBoardUuid.slice(0, 8),
										})
									: t("deck.status.noBoard")}
							</span>
							<a
								className="b6-secondary-link"
								href={section === "/profile" ? "/profile" : "/project"}
							>
								{tAny("project.boardTools")}
							</a>
						</aside>
					</main>
					<section
						className="b6-dock"
						style={{ height: dockHeight }}
						aria-label={t("deck.dock.label")}
					>
						<div
							className="b6-dock-resizer"
							onPointerDown={beginDockDrag}
							onDoubleClick={() => {
								setDockHeight(DEFAULT_DOCK_HEIGHT);
								window.localStorage.setItem(
									DOCK_STORAGE_KEY,
									String(DEFAULT_DOCK_HEIGHT),
								);
							}}
							aria-hidden="true"
						/>
						<div className="b6-dock-tabs" role="tablist">
							{DOCK_TABS.filter(
								([tab]) => mode === "expert" || tab !== "problems",
							).map(([tab, Icon]) => (
								<button
									key={tab}
									type="button"
									role="tab"
									aria-selected={dockTab === tab}
									className={dockTab === tab ? "is-active" : undefined}
									onClick={() => setDockTab(tab)}
								>
									<Icon />
									{t(`deck.dock.${tab}`)}
								</button>
							))}
						</div>
						<div className="b6-dock-content" role="tabpanel">
							<strong>{t(`deck.dock.${dockTab}`)}</strong>
							<span>{t(`deck.dock.${dockTab}Hint`)}</span>
							<span>{t("deck.dock.guidance")}</span>
							<a
								href={dockTab === "problems" ? "/devices/debug" : "/project"}
							>
								{tAny(
									dockTab === "problems" ? "debug.title" : "project.boardTools",
								)}
							</a>
						</div>
					</section>
				</div>
			</div>
			<footer className="b6-statusbar">
				<span>{t("deck.status.ready")}</span>
				<span>{contextTitle}</span>
				<span>
					{mode === "easy" ? t("deck.mode.easy") : t("deck.mode.expert")}
				</span>
				<span className="b6-statusbar-shortcuts">
					{t("deck.status.shortcuts")}
				</span>
			</footer>

			{mobile ? (
				<Paper
					id={DASHBOARD_BOTTOM_NAV_ID}
					className="b6-bottom-nav"
					elevation={3}
					square
				>
					<BottomNavigation
						showLabels
						value={section}
						onChange={(_event, value) => navigate(String(value))}
					>
						{bottomNavigation.map((item) => (
							<BottomNavigationAction
								key={item.href}
								value={item.href}
								label={item.label}
								icon={item.icon}
							/>
						))}
					</BottomNavigation>
				</Paper>
			) : null}

			{paletteOpen ? (
				<div className="b6-palette-layer" role="presentation">
					<button
						type="button"
						className="b6-palette-scrim"
						aria-label={t("deck.command.close")}
						onClick={() => setPaletteOpen(false)}
					/>
					<div
						className="b6-palette"
						role="dialog"
						aria-modal="true"
						aria-label={t("deck.command.title")}
					>
						<label className="b6-palette-search">
							<SearchIcon />
							<input
								ref={paletteInputRef}
								value={query}
								placeholder={t("deck.command.placeholder")}
								onChange={(event) => setQuery(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.preventDefault();
										runCommand(filteredCommands[0]);
									}
								}}
							/>
							<kbd>{t("deck.command.escape")}</kbd>
						</label>
						<div className="b6-command-list">
							{filteredCommands.length ? (
								filteredCommands.map((command, index) => (
									<button
										key={`${command.name}-${command.hint}`}
										type="button"
										className={index === 0 ? "is-top" : undefined}
										onClick={() => runCommand(command)}
									>
										<span>{command.name}</span>
										<small>{command.hint}</small>
									</button>
								))
							) : (
								<div className="b6-command-empty">
									{t("deck.command.empty")}
								</div>
							)}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
