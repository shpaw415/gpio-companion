import AccountCircleIcon from "@material-design-icons/svg/filled/account_circle.svg";
import DarkModeIcon from "@material-design-icons/svg/filled/dark_mode.svg";
import FolderIcon from "@material-design-icons/svg/filled/folder.svg";
import LightModeIcon from "@material-design-icons/svg/filled/light_mode.svg";
import MemoryIcon from "@material-design-icons/svg/filled/memory.svg";
import { navigate } from "@next/client";
import AppBar from "@shpaw415/mui-lite/AppBar";
import BottomNavigation, {
	BottomNavigationAction,
} from "@shpaw415/mui-lite/BottomNavigation";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import IconButton from "@shpaw415/mui-lite/IconButton";
import Paper from "@shpaw415/mui-lite/Paper";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";
import type { ReactNode } from "react";
import { ActionErrorProvider } from "../hooks/useActionError.tsx";
import { useColorMode } from "../hooks/useColorMode.tsx";
import { useDashboardMode } from "../hooks/useDashboardMode.tsx";
import { useT } from "../hooks/useLocale.tsx";
import useMobile from "../hooks/useMobile.ts";
import { usePathname } from "../hooks/usePathname.tsx";
import {
	DASHBOARD_BOTTOM_NAV_ID,
	isEmbedPath,
	isT3Path,
} from "../lib/t3-url.ts";

function currentSection(pathname: string) {
	if (pathname.startsWith("/devices")) {
		return "/devices";
	}
	if (pathname.startsWith("/profile")) {
		return "/profile";
	}
	return "/project";
}

export default function Layout({ children }: { children: React.JSX.Element }) {
	const { isDark, toggleMode } = useColorMode();
	const { isEasy, toggleMode: toggleDashboardMode } = useDashboardMode();
	const t = useT();
	const pathname = usePathname();
	const onT3 = isT3Path(pathname);
	const onEmbed = isEmbedPath(pathname);
	const mobile = useMobile();
	const sections: Array<{ href: string; label: string; icon: ReactNode }> = [
		{ href: "/project", label: t("nav.project"), icon: <FolderIcon /> },
		{ href: "/devices", label: t("nav.devices"), icon: <MemoryIcon /> },
		{ href: "/profile", label: t("nav.profile"), icon: <AccountCircleIcon /> },
	];

	const section = currentSection(pathname);

	if (onEmbed) {
		return (
			<ActionErrorProvider>
				<Box
					sx={{
						height: "100dvh",
						overflow: "hidden",
						bgcolor: "bg-main",
						display: "flex",
						flexDirection: "column",
					}}
				>
					{children}
				</Box>
			</ActionErrorProvider>
		);
	}

	return (
		<ActionErrorProvider>
			<Box
				sx={{
					height: "100dvh",
					overflow: "hidden",
					bgcolor: "bg-main",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<AppBar
					position="sticky"
					color="default"
					sx={{ flexShrink: 0, paddingTop: "env(safe-area-inset-top)" }}
				>
					<Toolbar className="gap-2" sx={{ minHeight: 48 }}>
						<img
							src="/static/logo.png"
							alt=""
							width={28}
							height={28}
							style={{
								width: 28,
								height: 28,
								borderRadius: 8,
								objectFit: "cover",
								flexShrink: 0,
								display: "block",
							}}
						/>
						<Typography
							variant="h6"
							Element="a"
							href="/project"
							noWrap
							sx={{ flexGrow: 1, minWidth: 0 }}
						>
							gpio-companion
						</Typography>
						{mobile
							? null
							: sections.map((item) => (
									<Button
										key={item.href}
										href={item.href}
										variant={section === item.href ? "contained" : "text"}
										size="small"
									>
										{item.label}
									</Button>
								))}
						<Button
							variant="text"
							size="small"
							aria-label={
								isEasy ? t("mode.switchToExpert") : t("mode.switchToEasy")
							}
							onClick={toggleDashboardMode}
						>
							{isEasy ? t("mode.easy") : t("mode.expert")}
						</Button>
						<IconButton
							aria-label={
								isDark ? t("theme.switchToLight") : t("theme.switchToDark")
							}
							color="secondary"
							onClick={toggleMode}
							size="small"
						>
							{isDark ? (
								<LightModeIcon fill="currentColor" />
							) : (
								<DarkModeIcon fill="currentColor" />
							)}
						</IconButton>
					</Toolbar>
				</AppBar>
				<Box
					className={
						onT3
							? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
							: "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-auto px-2 py-2"
					}
					sx={{
						flex: 1,
						minHeight: 0,
						...(onT3
							? {
									display: "flex",
									flexDirection: "column",
									overflow: "hidden",
								}
							: undefined),
						...(mobile
							? { pb: "calc(72px + env(safe-area-inset-bottom))" }
							: undefined),
					}}
				>
					{children}
				</Box>
				{mobile ? (
					<Paper
						id={DASHBOARD_BOTTOM_NAV_ID}
						elevation={3}
						square
						sx={{
							position: "fixed",
							left: 0,
							right: 0,
							bottom: 0,
							zIndex: 20,
							paddingBottom: "env(safe-area-inset-bottom)",
						}}
					>
						<BottomNavigation
							showLabels
							value={section}
							onChange={(_event, value) => {
								navigate(String(value));
							}}
						>
							{sections.map((item) => (
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
			</Box>
		</ActionErrorProvider>
	);
}
