import { GET as getDevice } from "@api/device";
import { GET as getPairing } from "@api/pair";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Stepper, { Step, StepLabel } from "@shpaw415/mui-lite/Stepper";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuth.ts";
import KeysForm from "./KeysForm.tsx";
import LoginPanel from "./LoginPanel.tsx";
import PairForm from "./PairForm.tsx";
import ProjectBrowser from "./ProjectBrowser.tsx";

const STEPS = ["Sign in", "Pair Pi", "GitHub", "Overview"] as const;

export default function Onboarding() {
	const session = useAuthSession();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [paired, setPaired] = useState(false);
	const [deviceUrl, setDeviceUrl] = useState("");
	const [githubReady, setGithubReady] = useState(false);

	useEffect(() => {
		const userId = session.data?.id;
		if (!userId) {
			setPaired(false);
			setDeviceUrl("");
			setGithubReady(false);
			return;
		}
		void getPairing().then(async (result) => {
			if (!result.paired) {
				setPaired(false);
				return;
			}
			setPaired(true);
			setDeviceUrl(result.device.deviceUrl);
			try {
				const device = await getDevice();
				if (!device.paired) {
					return;
				}
				const secrets = device.status.secrets as
					| { githubReady?: boolean }
					| undefined;
				setGithubReady(Boolean(secrets?.githubReady));
			} catch {
				setGithubReady(false);
			}
		});
	}, [session.data?.id]);

	const step = !loggedIn ? 0 : !paired ? 1 : !githubReady ? 2 : 3;

	return (
		<Stack spacing={4}>
			<Stepper activeStep={step} alternativeLabel>
				{STEPS.map((label, index) => (
					<Step key={label} completed={step > index}>
						<StepLabel>{label}</StepLabel>
					</Step>
				))}
			</Stepper>
			{step === 0 ? <LoginPanel /> : null}
			{step === 1 ? (
				<Stack spacing={2}>
					<Typography color="secondary">
						Connect over Bluetooth to load Device URL, pairing UUID, and key. If
						Web Bluetooth is unavailable, a signed command is copied for
						LightBlue or nRF Connect.
					</Typography>
					<PairForm
						onComplete={(url) => {
							setDeviceUrl(url);
							setPaired(true);
						}}
					/>
				</Stack>
			) : null}
			{step === 2 ? (
				<Stack spacing={2}>
					<Typography color="secondary">
						Use your GitHub account. Create a classic PAT with repo scope, then
						save username and token to the Pi.
					</Typography>
					<KeysForm onComplete={() => setGithubReady(true)} />
				</Stack>
			) : null}
			{step === 3 ? (
				<Stack spacing={3}>
					<Typography variant="h4" Element="h1">
						Overview
					</Typography>
					<Paper className="p-6" elevation={1}>
						<Typography variant="subtitle1">Hardware paired</Typography>
						<Typography color="secondary">{deviceUrl}</Typography>
						<Typography className="mt-2" color="secondary">
							GitHub credentials are on the Pi. Projects below are from your
							GitHub account.
						</Typography>
					</Paper>
					<ProjectBrowser />
				</Stack>
			) : null}
		</Stack>
	);
}
