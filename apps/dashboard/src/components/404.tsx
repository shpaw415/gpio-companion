import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import { useT } from "../hooks/useLocale.tsx";

export default function NotFound() {
	const t = useT();
	return (
		<Paper className="mx-auto mt-8 w-full max-w-md p-6 min-[900px]:mt-16 min-[900px]:p-8" elevation={1}>
			<Stack spacing={2} alignItems="center">
				<Typography variant="h5" className="min-[900px]:text-inherit">
					{t("common.pageNotFound")}
				</Typography>
				<Typography color="secondary" align="center">
					{t("common.pageMoved")}
				</Typography>
				<Button href="/project" variant="contained">
					{t("common.backHome")}
				</Button>
			</Stack>
		</Paper>
	);
}
