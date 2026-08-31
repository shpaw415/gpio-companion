import Box from "@shpaw415/mui-lite/Box";
import Card, { CardActionArea, CardContent } from "@shpaw415/mui-lite/Card";
import Typography from "@shpaw415/mui-lite/Typography";
import { type ReactNode } from "react";

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
			<Typography color="secondary" className="mb-4">
				{description}
			</Typography>
			<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{items.map((item) => (
					<li key={item.href}>
						<Card elevation={1}>
							<CardActionArea href={item.href}>
								<CardContent>
									<Typography variant="h6" className="mb-1">
										{item.title}
									</Typography>
									<Typography color="secondary" variant="body2">
										{item.description}
									</Typography>
								</CardContent>
							</CardActionArea>
						</Card>
					</li>
				))}
			</ul>
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
		<Box className="mb-4">
			<Typography variant="h4" Element="h1">
				{title}
			</Typography>
			{children ? <Box className="mt-1">{children}</Box> : null}
		</Box>
	);
}