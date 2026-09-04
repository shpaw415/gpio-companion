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
import logo from "../../../logo/logo.png";
import { authLogout, authSession, authToken, type Session } from "./api";
import { useColorMode } from "./color-mode";
import DevicesHub, { type DeviceTab } from "./components/DevicesHub";
import Login from "./components/Login";
import Profile from "./components/Profile";
import Project from "./components/Project";
import T3Frame from "./components/T3Frame";
import { BoardSelectionProvider } from "./hooks/useBoardSelection";

type Section = "project" | "devices" | "profile";

function SunIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
			<circle cx="12" cy="12" r="4" fill="currentColor" />
			<path
				d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				fill="none"
			/>
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
			<path
				d="M17 13.5A7 7 0 1 1 10.5 7 5.5 5.5 0 0 0 17 13.5z"
				fill="currentColor"
			/>
		</svg>
	);
}

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
		<BoardSelectionProvider
			onOpenT3={() => {
				setSection("devices");
				setDeviceTab("t3");
			}}
		>
			<Box
				sx={{
					height: "100%",
					minHeight: 0,
					bgcolor: "bg-main",
					display: "flex",
					flexDirection: "column",
					overflow: onT3 ? "hidden" : undefined,
				}}
			>
				<CssBaseline />
				<AppBar position="sticky" color="default">
					<Toolbar sx={{ gap: 1 }}>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 1.5,
								flexGrow: 1,
								minWidth: 0,
							}}
						>
							<img
								src={logo}
								alt=""
								width={32}
								height={32}
								style={{
									width: 32,
									height: 32,
									borderRadius: 8,
									objectFit: "cover",
									flexShrink: 0,
									display: "block",
								}}
							/>
							<Typography variant="h6" noWrap>
								gpio-companion
							</Typography>
						</Box>
						{signedIn
							? (
									[
										["project", "Project"],
										["devices", "Devices"],
										["profile", "Profile"],
									] as const
								).map(([id, label]) => (
									<Button
										key={id}
										variant={section === id ? "contained" : "text"}
										size="small"
										onClick={() => setSection(id)}
									>
										{label}
									</Button>
								))
							: null}
						<IconButton
							aria-label={
								isDark ? "Switch to light mode" : "Switch to dark mode"
							}
							color="secondary"
							onClick={toggleMode}
							size="small"
						>
							{isDark ? <SunIcon /> : <MoonIcon />}
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
									overflow: "hidden",
									px: 1,
									pt: 0,
									pb: 0,
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
