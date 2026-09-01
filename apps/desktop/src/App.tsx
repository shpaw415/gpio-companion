import AppBar from "@shpaw415/mui-lite/AppBar";
import Box from "@shpaw415/mui-lite/Box";
import CssBaseline from "@shpaw415/mui-lite/CssBaseline";
import IconButton from "@shpaw415/mui-lite/IconButton";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Stack from "@shpaw415/mui-lite/Stack";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { authLogout, authToken } from "./api";
import { useColorMode } from "./color-mode";
import Devices from "./components/Devices";
import Login from "./components/Login";
import Pair from "./components/Pair";
import Wifi from "./components/Wifi";

type View = "devices" | "pair" | "wifi";

export default function App() {
	const { isDark, toggleMode } = useColorMode();
	const [ready, setReady] = useState(false);
	const [signedIn, setSignedIn] = useState(false);
	const [view, setView] = useState<View>("devices");

	useEffect(() => {
		void authToken()
			.then((token) => setSignedIn(Boolean(token)))
			.finally(() => setReady(true));
	}, []);

	if (!ready) {
		return (
			<Stack
				sx={{
					minHeight: "100dvh",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<CircularProgress />
			</Stack>
		);
	}

	return (
		<Box sx={{ minHeight: "100dvh", bgcolor: "bg-main" }}>
			<CssBaseline />
			<AppBar position="sticky" color="default">
				<Toolbar sx={{ gap: 2 }}>
					<Typography variant="h6" sx={{ flexGrow: 1 }}>
						gpio-companion
					</Typography>
					<IconButton
						aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
						color="secondary"
						onClick={toggleMode}
					>
						{isDark ? "Light" : "Dark"}
					</IconButton>
				</Toolbar>
			</AppBar>
			<Box sx={{ mx: "auto", maxWidth: 512, p: 3 }}>
				{signedIn ? (
					view === "pair" ? (
						<Pair onBack={() => setView("devices")} />
					) : view === "wifi" ? (
						<Wifi onBack={() => setView("devices")} />
					) : (
						<Devices
							onPair={() => setView("pair")}
							onWifi={() => setView("wifi")}
							onSignOut={() => {
								void authLogout().then(() => {
									setSignedIn(false);
									setView("devices");
								});
							}}
						/>
					)
				) : (
					<Login
						onSignedIn={() => {
							setSignedIn(true);
							setView("devices");
						}}
					/>
				)}
			</Box>
		</Box>
	);
}
