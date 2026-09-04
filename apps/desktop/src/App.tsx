import AppBar from "@shpaw415/mui-lite/AppBar";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import CssBaseline from "@shpaw415/mui-lite/CssBaseline";
import IconButton from "@shpaw415/mui-lite/IconButton";
import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Stack from "@shpaw415/mui-lite/Stack";
import Toolbar from "@shpaw415/mui-lite/Toolbar";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { authLogout, authSession, authToken, type Session } from "./api";
import { useColorMode } from "./color-mode";
import DevicesHub, { type DeviceTab } from "./components/DevicesHub";
import Login from "./components/Login";
import Profile from "./components/Profile";
import Project from "./components/Project";
import T3Frame from "./components/T3Frame";
import { BoardSelectionProvider } from "./hooks/useBoardSelection";

type Section = "project" | "devices" | "profile";

export default function App() {
	const { isDark, toggleMode } = useColorMode();
	const [ready, setReady] = useState(false);
	const [signedIn, setSignedIn] = useState(false);
	const [session, setSession] = useState<Session | null>(null);
	const [section, setSection] = useState<Section>("devices");
	const [deviceTab, setDeviceTab] = useState<DeviceTab>("overview");

	useEffect(() => {
		void authToken()
			.then((token) => setSignedIn(Boolean(token)))
			.finally(() => setReady(true));
	}, []);

	useEffect(() => {
		if (!signedIn) {
			setSession(null);
			return;
		}
		void authSession()
			.then(setSession)
			.catch(() => setSession(null));
	}, [signedIn]);

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

	const onT3 = signedIn && section === "devices" && deviceTab === "t3";
	const admin = session?.role === "admin";

	return (
		<BoardSelectionProvider>
			<Box
				sx={{
					minHeight: "100dvh",
					bgcolor: "bg-main",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<CssBaseline />
				<AppBar position="sticky" color="default">
					<Toolbar sx={{ gap: 2 }}>
						<Typography variant="h6" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
							gpio-companion
						</Typography>
						{signedIn ? (
							<>
								<Button
									variant="text"
									size="small"
									onClick={() => setSection("project")}
								>
									Project
								</Button>
								<Button
									variant="text"
									size="small"
									onClick={() => setSection("devices")}
								>
									Devices
								</Button>
								<Button
									variant="text"
									size="small"
									onClick={() => setSection("profile")}
								>
									Profile
								</Button>
							</>
						) : null}
						<IconButton
							aria-label={
								isDark ? "Switch to light mode" : "Switch to dark mode"
							}
							color="secondary"
							onClick={toggleMode}
						>
							{isDark ? "Light" : "Dark"}
						</IconButton>
					</Toolbar>
				</AppBar>
				<Box
					sx={{
						...(onT3
							? {
									flex: 1,
									minHeight: 0,
									display: "flex",
									flexDirection: "column",
									px: 2,
									pt: 1,
								}
							: {
									mx: "auto",
									width: "100%",
									maxWidth: 1024,
									p: 3,
								}),
					}}
				>
					{signedIn ? (
						section === "project" ? (
							<Project />
						) : section === "profile" ? (
							<Profile
								session={session}
								onSignOut={() => {
									void authLogout().then(() => {
										setSignedIn(false);
										setSection("devices");
										setDeviceTab("overview");
									});
								}}
							/>
						) : (
							<DevicesHub
								tab={deviceTab}
								onTab={setDeviceTab}
								admin={Boolean(admin)}
							/>
						)
					) : (
						<Login
							onSignedIn={() => {
								setSignedIn(true);
								setSection("devices");
							}}
						/>
					)}
				</Box>
				{signedIn ? <T3Frame visible={onT3} /> : null}
			</Box>
		</BoardSelectionProvider>
	);
}
