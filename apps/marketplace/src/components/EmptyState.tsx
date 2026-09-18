import Button from "@shpaw415/mui-lite/Button";
import Paper from "@shpaw415/mui-lite/Paper";
import Typography from "@shpaw415/mui-lite/Typography";
import type { ReactNode } from "react";
import { ArrowIcon } from "./icons.tsx";

export type EmptyStateProps = {
	title: string;
	description: string;
	actionLabel?: string;
	actionHref?: string;
	onAction?: () => void;
	icon?: ReactNode;
};

export default function EmptyState({
	title,
	description,
	actionLabel,
	actionHref,
	onAction,
	icon,
}: EmptyStateProps) {
	return (
		<Paper className="market-empty-state circuit-grid" variant="outlined">
			<div className="market-empty-icon" aria-hidden="true">
				{icon ?? (
					<span className="market-open-circuit">
						<i />
						<i />
					</span>
				)}
			</div>
			<Typography variant="h4" component="h2">
				{title}
			</Typography>
			<Typography color="textSecondary">{description}</Typography>
			{actionLabel ? (
				<Button
					variant="contained"
					href={actionHref}
					onClick={onAction}
					endIcon={<ArrowIcon />}
				>
					{actionLabel}
				</Button>
			) : null}
		</Paper>
	);
}
