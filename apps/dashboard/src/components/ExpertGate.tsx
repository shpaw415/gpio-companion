import Alert from "@shpaw415/mui-lite/Alert";
import Button from "@shpaw415/mui-lite/Button";
import Stack from "@shpaw415/mui-lite/Stack";
import type { ReactNode } from "react";
import { useDashboardMode } from "../hooks/useDashboardMode.tsx";
import { useT } from "../hooks/useLocale.tsx";

export default function ExpertGate({ children }: { children: ReactNode }) {
	const { isEasy, setMode } = useDashboardMode();
	const t = useT();
	if (!isEasy) {
		return children;
	}
	return (
		<Stack spacing={2}>
			<Alert severity="info">
				{t("mode.expertPage")}{" "}
				<Button type="button" variant="text" onClick={() => setMode("expert")}>
					{t("mode.switchToExpertShort")}
				</Button>
			</Alert>
		</Stack>
	);
}
