import AppBar from "@shpaw415/mui-lite/AppBar";
import BottomNavigation, {
	BottomNavigationAction,
} from "@shpaw415/mui-lite/BottomNavigation";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";

const nav = [
	{ href: "/", label: "Home" },
	{ href: "/projects", label: "Projects" },
	{ href: "/pair", label: "Pair" },
	{ href: "/notifications", label: "Notify" },
	{ href: "/wifi", label: "WiFi" },
	{ href: "/keys", label: "Keys" },
	{ href: "/login", label: "Sign in" },
];

function currentTab(pathname: string) {
	const match = nav.find(
		(item) => item.href !== "/" && pathname.startsWith(item.href),
	);
	return match?.href ?? "/";
}

export default function Layout({ children }: { children: React.JSX.Element }) {
	const [mobile, setMobile] = useState(false);
	const [tab, setTab] = useState("/");

	useEffect(() => {
		const media = window.matchMedia("(max-width: 899px)");
		const sync = () => {
			setMobile(media.matches);
			setTab(currentTab(window.location.pathname));
		};
		sync();
		media.addEventListener("change", sync);
		return () => media.removeEventListener("change", sync);
	}, []);

	return (
		<Box sx={{ minHeight: "100dvh", bgcolor: "bg-main" }}>
			<AppBar position="sticky" color="default">
				<Toolbar className="gap-2">
					<Typography variant="h6" Element="a" href="/" sx={{ flexGrow: 1 }}>
						gpio-companion
					</Typography>
					{mobile
						? null
						: nav.map((item) => (
								<Button
									key={item.href}
									href={item.href}
									variant="text"
									size="small"
								>
									{item.label}
								</Button>
							))}
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
						value={tab}
						onChange={(_event, value) => {
							const next = String(value);
							setTab(next);
							window.location.assign(next);
						}}
					>
						{nav.map((item) => (
							<BottomNavigationAction
								key={item.href}
								value={item.href}
								label={item.label}
							/>
						))}
					</BottomNavigation>
				</Paper>
			) : null}
		</Box>
	);
}
