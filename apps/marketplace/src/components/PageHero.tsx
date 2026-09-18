import Chip from "@shpaw415/mui-lite/Chip";
import Typography from "@shpaw415/mui-lite/Typography";
import type { ReactNode } from "react";

export type PageHeroProps = {
	eyebrow?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	visual?: ReactNode;
	compact?: boolean;
};

export default function PageHero({
	eyebrow,
	title,
	description,
	actions,
	visual,
	compact = false,
}: PageHeroProps) {
	return (
		<section
			className={`market-page-hero circuit-grid ${compact ? "is-compact" : ""}`}
		>
			<div className="market-page-hero-copy">
				{eyebrow ? (
					<Chip color="secondary" variant="outlined" size="small">
						{eyebrow}
					</Chip>
				) : null}
				<Typography variant={compact ? "h3" : "h1"} component="h1">
					{title}
				</Typography>
				{description ? (
					<Typography color="textSecondary">{description}</Typography>
				) : null}
				{actions ? (
					<div className="market-page-hero-actions">{actions}</div>
				) : null}
			</div>
			{visual ? <div className="market-page-hero-visual">{visual}</div> : null}
		</section>
	);
}
