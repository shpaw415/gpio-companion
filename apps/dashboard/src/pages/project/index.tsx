import { GET as getDevice } from "@api/device";
import { GET as getPairing } from "@api/pair";
import ProjectBrowser from "@components/ProjectBrowser";
import Alert from "@shpaw415/mui-lite/Alert";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Stepper, { Step, StepLabel } from "@shpaw415/mui-lite/Stepper";
import Typography from "@shpaw415/mui-lite/Typography";
import { useEffect, useState } from "react";
import { SectionHeader } from "../../components/Section.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";

const STEPS = ["Sign in", "Pair Pi", "GitHub", "Ready"] as const;

const NEXT: Record<
	number,
	{ href: string; label: string; hint: string } | undefined
> = {
	0: {
		href: "/profile",
		label: "Sign in",
		hint: "Sign in with GitHub to start.",
	},
	1: {
		href: "/devices/pair",
		label: "Pair a board",
		hint: "Pair a Pi from the Devices section to use the device API.",
	},
	2: {
		href: "/devices/keys",
		label: "Save GitHub keys",
		hint: "Save your GitHub username and PAT to the Pi.",
	},
	3: undefined,
};

export default function ProjectPage() {
	const session = useAuthSession();
	const { run } = useActionError();
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
		void run(getPairing()).then(async (result) => {
			if (!result?.paired) {
				setPaired(false);
				return;
			}
			setPaired(true);
			setDeviceUrl(result.device.deviceUrl);
			const device = await run(getDevice());
			if (!device?.paired) {
				setGithubReady(false);
				return;
			}
			const secrets = device.status.secrets as
				| { githubReady?: boolean }
				| undefined;
			setGithubReady(Boolean(secrets?.githubReady));
		});
	}, [session.data?.id]);

	const step = !loggedIn ? 0 : !paired ? 1 : !githubReady ? 2 : 3;
	const next = NEXT[step] ?? undefined;

	return (
		<Stack spacing={4}>
			<SectionHeader title="Project">
				<Typography color="secondary">
					PCB, breadboard, and technical files the on-device agent pushed to
					GitHub. Open a repo to view the PCB preview and breadboard wiring.
				</Typography>
			</SectionHeader>

			<Paper className="p-6" elevation={1}>
				<Stack spacing={3}>
					<Typography variant="h6">Set up your board</Typography>
					<Stepper activeStep={step} alternativeLabel>
						{STEPS.map((label, index) => (
							<Step key={label} completed={step > index}>
								<StepLabel>{label}</StepLabel>
							</Step>
						))}
					</Stepper>
					{next ? (
						<Box className="flex flex-wrap items-center justify-between gap-4">
							<Typography color="secondary">{next.hint}</Typography>
							<Button href={next.href} variant="contained">
								{next.label}
							</Button>
						</Box>
					) : (
						<Alert severity="success">
							Ready — board paired and GitHub keys saved on the Pi.
						</Alert>
					)}
					{paired ? (
						<Typography variant="body2" color="secondary">
							{deviceUrl}
						</Typography>
					) : null}
				</Stack>
			</Paper>

			<div>
				<Typography variant="h5" className="mb-3">
					Your projects
				</Typography>
				<ProjectBrowser />
			</div>
		</Stack>
	);
}