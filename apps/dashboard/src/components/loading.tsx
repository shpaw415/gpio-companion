import Paper from "@shpaw415/mui-lite/Paper";
import Skeleton from "@shpaw415/mui-lite/Skeleton";
import Stack from "@shpaw415/mui-lite/Stack";
import { LinesSkeleton } from "./skeletons.tsx";

export default function Loading() {
	return (
		<Stack spacing={4} aria-busy="true">
			<Stack spacing={1}>
				<Skeleton variant="rounded" height={34} width="32%" />
				<Skeleton variant="text" width="58%" />
			</Stack>
			<Paper className="p-4 min-[900px]:p-6" elevation={1}>
				<LinesSkeleton lines={3} />
			</Paper>
			<Paper className="p-4 min-[900px]:p-6" elevation={1}>
				<LinesSkeleton lines={5} />
			</Paper>
		</Stack>
	);
}
