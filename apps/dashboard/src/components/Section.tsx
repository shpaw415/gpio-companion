import Box from "@shpaw415/mui-lite/Box";
import Card, { CardActionArea } from "@shpaw415/mui-lite/Card";
import Stack from "@shpaw415/mui-lite/Stack";
import Typography from "@shpaw415/mui-lite/Typography";
import type { ReactNode } from "react";

export type SectionItem = {
	href: string;
	title: string;
	description: string;
};

export default function SectionHub({
	description,
	items,
}: {
	description: string;
	items: SectionItem[];
}) {
	return (
		<Box>
			{description ? (
				<Typography color="secondary" variant="body2" className="mb-2">
					{description}
				</Typography>
			) : null}
			<Stack spacing={1}>
				{items.map((item) => (
					<Card key={item.href} elevation={1}>
						<CardActionArea href={item.href}>
							<Box className="px-3 py-2">
								<Typography variant="subtitle2">{item.title}</Typography>
								<Typography color="secondary" variant="caption">
									{item.description}
								</Typography>
							</Box>
						</CardActionArea>
					</Card>
				))}
			</Stack>
		</Box>
	);
}

export function SectionHeader({
	title,
	children,
}: {
	title: string;
	children?: ReactNode;
}) {
	return (
		<Box className="mb-2">
			<Typography variant="subtitle1" Element="h1">
				{title}
			</Typography>
			{children ? <Box className="mt-0.5">{children}</Box> : null}
		</Box>
	);
}
