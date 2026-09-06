import { GET as getPairing } from "@api/pair";
import DeviceSelect from "@components/DeviceSelect";
import GpioPanel from "@components/GpioPanel";
import ProjectBrowser from "@components/ProjectBrowser";
import Box from "@shpaw415/mui-lite/Box";
import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Stepper, { Step, StepLabel } from "@shpaw415/mui-lite/Stepper";
import Typography from "@shpaw415/mui-lite/Typography";
import type { GpioSnapshot } from "gpio-companion";
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionHeader } from "../../components/Section.tsx";
import { LinesSkeleton } from "../../components/skeletons.tsx";
import { useActionError } from "../../hooks/useActionError.tsx";
import { useAuthSession } from "../../hooks/useAuth.ts";
import { useBoardSelection } from "../../hooks/useBoardSelection.tsx";
import useMobile from "../../hooks/useMobile.ts";
import type { StoredPairing } from "../../lib/pairing-store.ts";

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
		label: "Connect GitHub",
		hint: "Install the gpio-companion GitHub App so the Pi can push.",
	},
	3: undefined,
};

export default function ProjectPage() {
	const session = useAuthSession();
	const { run } = useActionError();
	const mobile = useMobile();
	const { uuid: selectedUuid, setUuid: selectBoard } = useBoardSelection();
	const loggedIn = Boolean(session.data?.id || session.data?.email);
	const [paired, setPaired] = useState(false);
	const [devices, setDevices] = useState<StoredPairing[]>([]);
	const [githubReady, setGithubReady] = useState(false);
	const [pairingLoading, setPairingLoading] = useState(true);
	const [gpioSnapshot, setGpioSnapshot] = useState<GpioSnapshot | null>(null);
	const selectedUuidRef = useRef(selectedUuid);
	selectedUuidRef.current = selectedUuid;
	const livePins = useMemo(() => {
		const pins: Record<number, 0 | 1> = {};
		for (const pin of gpioSnapshot?.pins ?? []) {
			if (pin.type === "gpio" && (pin.value === 0 || pin.value === 1)) {
				pins[pin.physical] = pin.value;
			}
		}
		return pins;
	}, [gpioSnapshot]);

	useEffect(() => {
		const userId = session.data?.id;
		if (!userId) {
			setPaired(false);
			setDevices([]);
			setGithubReady(false);
			setPairingLoading(false);
			return;
		}
		setPairingLoading(true);
		void run(getPairing())
			.then((result) => {
				const next = result?.devices ?? [];
				setDevices(next);
				setPaired(next.length > 0);
				if (!selectedUuidRef.current && next[0]) {
					selectBoard(next[0].uuid);
				}
			})
			.finally(() => {
				setPairingLoading(false);
			});
	}, [session.data?.id, run, selectBoard]);

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

			{step < 3 || pairingLoading ? (
				<Paper className="p-4 min-[900px]:p-6" elevation={1}>
					<Stack spacing={3}>
						<Typography variant="h6">Set up your board</Typography>
						{pairingLoading ? (
							<LinesSkeleton lines={2} />
						) : (
							<>
								<Stepper
									activeStep={step}
									alternativeLabel={!mobile}
									orientation={mobile ? "vertical" : "horizontal"}
								>
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
								) : null}
							</>
						)}
					</Stack>
				</Paper>
			) : null}

			{paired ? (
				<Paper className="p-4 min-[900px]:p-6" elevation={1}>
					<Stack spacing={2}>
						<DeviceSelect
							devices={devices}
							value={selectedUuid || devices[0]?.uuid || ""}
							onChange={selectBoard}
						/>
						<GpioPanel
							uuid={selectedUuid || devices[0]?.uuid || ""}
							poll
							onSnapshot={setGpioSnapshot}
						/>
					</Stack>
				</Paper>
			) : null}

			<div>
				<Typography variant="h5" className="mb-3">
					Your projects
				</Typography>
				<ProjectBrowser onConfigured={setGithubReady} livePins={livePins} />
			</div>
		</Stack>
	);
}
