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
import { type ReactNode } from "react";
import { ActionErrorProvider } from "../hooks/useActionError.tsx";
import { useColorMode } from "../hooks/useColorMode.tsx";
import useMobile from "../hooks/useMobile.ts";
import { usePathname } from "../hooks/usePathname.tsx";
import { isT3Path } from "../lib/t3-url.ts";

const sections: Array<{ href: string; label: string; icon: ReactNode }> = [
	{ href: "/project", label: "Project", icon: <FolderIcon /> },
	{ href: "/devices", label: "Devices", icon: <MemoryIcon /> },
	{ href: "/profile", label: "Profile", icon: <AccountCircleIcon /> },
];

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
	const pathname = usePathname();
	const onT3 = isT3Path(pathname);
	const mobile = useMobile();

	const section = currentSection(pathname);

	return (
		<ActionErrorProvider>
			<Box
				sx={{
					minHeight: "100dvh",
					bgcolor: "bg-main",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<AppBar
					position="sticky"
					color="default"
					sx={{ paddingTop: "env(safe-area-inset-top)" }}
				>
					<Toolbar className="gap-2">
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
										variant="text"
										size="small"
									>
										{item.label}
									</Button>
								))}
						<IconButton
							aria-label={
								isDark ? "Switch to light mode" : "Switch to dark mode"
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
							? "flex min-h-0 w-full min-w-0 flex-1 flex-col px-3 pt-2 min-[900px]:px-4"
							: "mx-auto w-full min-w-0 max-w-5xl px-3 py-4 min-[900px]:px-4 min-[900px]:py-8"
					}
					sx={{
						...(onT3
							? {
									flex: 1,
									minHeight: 0,
									display: "flex",
									flexDirection: "column",
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
