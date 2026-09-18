import Paper from "@shpaw415/mui-lite/Paper";
import Skeleton from "@shpaw415/mui-lite/Skeleton";
import Stack from "@shpaw415/mui-lite/Stack";
import { TableCell, TableRow } from "@shpaw415/mui-lite/Table";

const LINE_WIDTHS = ["78%", "92%", "64%", "85%", "52%"];
const CHIP_WIDTHS = [72, 96, 88, 110];

export function LinesSkeleton({ lines = 3 }: { lines?: number }) {
	const items = Array.from({ length: lines }, (_, index) => ({
		key: `line-${index}`,
		width: LINE_WIDTHS[index % LINE_WIDTHS.length],
	}));
	return (
		<Stack spacing={1.5} aria-busy="true">
			{items.map((item) => (
				<Skeleton key={item.key} variant="text" width={item.width} />
			))}
		</Stack>
	);
}

export function ChipsSkeleton({ count = 3 }: { count?: number }) {
	const chips = Array.from({ length: count }, (_, index) => ({
		key: `chip-${index}`,
		width: CHIP_WIDTHS[index % CHIP_WIDTHS.length],
	}));
	return (
		<Stack direction="row" spacing={1} className="flex-wrap">
			{chips.map((chip) => (
				<Skeleton
					key={chip.key}
					variant="rounded"
					height={26}
					width={chip.width}
				/>
			))}
		</Stack>
	);
}

export function SelectSkeleton({ height = 56 }: { height?: number }) {
	return <Skeleton variant="rounded" height={height} aria-busy="true" />;
}

export function TableRowsSkeleton({
	rows = 5,
	columns = 3,
}: {
	rows?: number;
	columns?: number;
}) {
	return (
		<>
			{Array.from({ length: rows }, (_, row) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows never reorder
				<TableRow key={row}>
					{Array.from({ length: columns }, (_, column) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder cells never reorder
						<TableCell key={column}>
							<Skeleton variant="text" width={column === 0 ? "60%" : "85%"} />
						</TableCell>
					))}
				</TableRow>
			))}
		</>
	);
}

export function BoardCardSkeleton() {
	return (
		<Paper className="device-board-row w-full" elevation={0} aria-busy="true">
			<Stack
				direction="row"
				spacing={1}
				className="items-center px-2"
				sx={{ minHeight: 52 }}
			>
				<Skeleton variant="rounded" height={34} width={34} />
				<Stack spacing={0.5} sx={{ flex: 1 }}>
					<Skeleton variant="text" width="40%" />
					<Skeleton variant="text" width="24%" />
				</Stack>
				<Skeleton variant="circular" height={8} width={8} />
			</Stack>
		</Paper>
	);
}

export function ListSkeleton({ items = 3 }: { items?: number }) {
	return (
		<Stack spacing={3} aria-busy="true">
			{Array.from({ length: items }, (_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static placeholder items never reorder
				<Stack key={index} spacing={1}>
					<Skeleton variant="text" width="62%" />
					<Skeleton variant="text" width="34%" />
					<Stack direction="row" spacing={1}>
						<Skeleton variant="rounded" height={32} width={90} />
						<Skeleton variant="rounded" height={32} width={90} />
					</Stack>
				</Stack>
			))}
		</Stack>
	);
}

export function PreviewSkeleton({
	height = 280,
	title = true,
}: {
	height?: number;
	title?: boolean;
}) {
	return (
		<Paper className="p-4 min-[900px]:p-6" elevation={1} aria-busy="true">
			<Stack spacing={2}>
				{title ? <Skeleton variant="text" width="30%" /> : null}
				<Skeleton variant="rounded" height={height} />
			</Stack>
		</Paper>
	);
}
