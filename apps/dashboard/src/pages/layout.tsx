import AccountCircleIcon from "@material-design-icons/svg/filled/account_circle.svg";
import DarkModeIcon from "@material-design-icons/svg/filled/dark_mode.svg";
import FolderIcon from "@material-design-icons/svg/filled/folder.svg";
import LightModeIcon from "@material-design-icons/svg/filled/light_mode.svg";
import MemoryIcon from "@material-design-icons/svg/filled/memory.svg";
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
import { navigate } from "@next/client";
import { type ReactNode, useEffect, useState } from "react";
import { ActionErrorProvider } from "../hooks/useActionError.tsx";
import { useColorMode } from "../hooks/useColorMode.tsx";

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
	const [mobile, setMobile] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(max-width: 899px)");
		const sync = () => {
			setMobile(media.matches);
		};
		sync();
		media.addEventListener("change", sync);
		return () => media.removeEventListener("change", sync);
	}, []);

	const section =
		typeof window === "undefined"
			? "/project"
			: currentSection(window.location.pathname);

	return (
		<ActionErrorProvider>
		<Box sx={{ minHeight: "100dvh", bgcolor: "bg-main" }}>
			<AppBar position="sticky" color="default">
				<Toolbar className="gap-2">
					<Typography variant="h6" Element="a" href="/project" sx={{ flexGrow: 1 }}>
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
				className="mx-auto max-w-5xl px-4 py-8"
				sx={
					mobile
						? { pb: "calc(72px + env(safe-area-inset-bottom))" }
						: undefined
				}
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