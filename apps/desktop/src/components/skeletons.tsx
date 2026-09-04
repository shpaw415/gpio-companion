import Paper from "@shpaw415/mui-lite/Paper";
import Skeleton from "@shpaw415/mui-lite/Skeleton";
import Stack from "@shpaw415/mui-lite/Stack";

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
		<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
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

export function SelectSkeleton({
	height = 56,
	width = 240,
}: {
	height?: number;
	width?: number | string;
}) {
	return (
		<Skeleton
			variant="rounded"
			height={height}
			width={width}
			aria-busy="true"
		/>
	);
}

export function BoardCardSkeleton() {
	return (
		<Paper sx={{ p: 3 }} elevation={1} aria-busy="true">
			<Stack spacing={2}>
				<Skeleton variant="text" width="38%" />
				<Skeleton variant="text" width="72%" />
				<Skeleton variant="text" width="88%" />
				<Skeleton variant="rounded" height={56} />
				<ChipsSkeleton count={4} />
				<Stack direction="row" spacing={1}>
					<Skeleton variant="rounded" height={32} width={120} />
					<Skeleton variant="rounded" height={32} width={88} />
				</Stack>
			</Stack>
		</Paper>
	);
}

export function ListSkeleton({ items = 3 }: { items?: number }) {
	const rows = Array.from({ length: items }, (_, index) => ({
		key: `item-${index}`,
	}));
	return (
		<Stack spacing={2} aria-busy="true">
			{rows.map((row) => (
				<Paper key={row.key} sx={{ p: 2 }} elevation={1}>
					<Stack spacing={1}>
						<Skeleton variant="text" width="62%" />
						<Skeleton variant="text" width="34%" />
						<Skeleton variant="rounded" height={32} width={90} />
					</Stack>
				</Paper>
			))}
		</Stack>
	);
}

export function PreviewSkeleton({ height = 280 }: { height?: number }) {
	return (
		<Paper sx={{ p: 3 }} elevation={1} aria-busy="true">
			<Stack spacing={2}>
				<Skeleton variant="text" width="30%" />
				<Skeleton variant="rounded" height={height} />
			</Stack>
		</Paper>
	);
}
