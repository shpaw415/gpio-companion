"use dynamic";

import Button from "@shpaw415/mui-lite/Button";
import Chip from "@shpaw415/mui-lite/Chip";
import Paper from "@shpaw415/mui-lite/Paper";
import Table, {
	TableBody,
	TableCell,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import Typography from "@shpaw415/mui-lite/Typography";
import EmptyState from "../../components/EmptyState.tsx";
import { useT } from "../../hooks/useLocale.tsx";
import { usePath } from "../../hooks/usePath.ts";

function orderIdFromPath(pathname: string): string {
	const segments = pathname.split("/").filter(Boolean);
	return segments[segments.length - 1] ?? "";
}

export default function OrderDetailPage() {
	const t = useT();
	const pathname = usePath() ?? "";
	const id = orderIdFromPath(pathname);

	if (!id) {
		return (
			<EmptyState
				title={t("orders.emptyTitle")}
				description={t("orders.emptyBody")}
				actionLabel={t("orders.backToOrders")}
				actionHref="/orders"
			/>
		);
	}

	return (
		<div>
			<Typography variant="h4" component="h1">
				{t("orders.detailTitle", { id })}
			</Typography>
			<Typography color="textSecondary">{t("orders.detailNote")}</Typography>
			<Paper variant="outlined" className="market-totals">
				<div className="row">
					<span>{t("orders.payment")}</span>
					<Chip size="small">—</Chip>
				</div>
				<div className="row">
					<span>{t("orders.fulfillment")}</span>
					<Chip size="small">—</Chip>
				</div>
				<div className="row">
					<span>{t("orders.tracking")}</span>
					<span>—</span>
				</div>
				<div className="row grand">
					<span>{t("orders.total")}</span>
					<span>—</span>
				</div>
			</Paper>
			<Paper variant="outlined" className="market-table-shell">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>{t("catalog.kit")}</TableCell>
							<TableCell>{t("catalog.quantity")}</TableCell>
							<TableCell>{t("catalog.price")}</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						<TableRow>
							<TableCell colSpan={3} style={{ color: "var(--market-muted)" }}>
								{t("orders.detailNote")}
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</Paper>
			<div className="bar">
				<Button variant="text" href="/orders">
					{t("orders.backToOrders")}
				</Button>
			</div>
		</div>
	);
}
