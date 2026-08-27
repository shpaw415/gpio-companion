import { CircularProgress } from "@shpaw415/mui-lite/Progress";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";

export default function Loading() {
	return (
		<Stack
			className="min-h-[40vh]"
			alignItems="center"
			justifyContent="center"
			spacing={2}
		>
			<CircularProgress />
			<Typography color="secondary">Loading</Typography>
		</Stack>
	);
}
