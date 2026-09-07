import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import type { ReactNode } from "react";
import { useDashboardMode } from "../hooks/useDashboardMode.tsx";

export default function ExpertGate({ children }: { children: ReactNode }) {
	const { isEasy, setMode } = useDashboardMode();
	if (!isEasy) {
		return children;
	}
	return (
		<Stack spacing={2}>
			<Alert severity="info">
				This page is Expert mode.{" "}
				<Button type="button" variant="text" onClick={() => setMode("expert")}>
					Switch to Expert
				</Button>
			</Alert>
		</Stack>
	);
}
