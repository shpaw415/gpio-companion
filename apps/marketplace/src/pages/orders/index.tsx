import Button from "@shpaw415/mui-lite/Button";
import Table, {
	TableBody,
	TableCell,
	TableHead,
	TableRow,
} from "@shpaw415/mui-lite/Table";
import Typography from "@shpaw415/mui-lite/Typography";
import { useState } from "react";
import EmptyState from "../../components/EmptyState.tsx";
import TablePaginationShell, {
	type RowsPerPage,
} from "../../components/TablePaginationShell.tsx";
import { useT } from "../../hooks/useLocale.tsx";

export default function OrdersPage() {
	const t = useT();
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(10);
	// No backend yet: order history loads from D1 after OpenAuthster lands.
	const orders: readonly [] = [];

	if (orders.length === 0) {
		return (
			<div>
				<Typography variant="h4" component="h1">
					{t("orders.title")}
				</Typography>
				<Typography color="textSecondary">{t("orders.subtitle")}</Typography>
				<EmptyState
					title={t("orders.emptyTitle")}
					description={t("orders.emptyBody")}
					actionLabel={t("action.browseKits")}
					actionHref="/kits"
				/>
			</div>
		);
	}

	return (
		<div>
			<Typography variant="h4" component="h1">
				{t("orders.title")}
			</Typography>
			<TablePaginationShell
				count={orders.length}
				page={page}
				rowsPerPage={rowsPerPage}
				onPageChange={setPage}
				onRowsPerPageChange={(rows) => {
					setRowsPerPage(rows);
					setPage(0);
				}}
			>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>{t("orders.orderId")}</TableCell>
							<TableCell>{t("orders.date")}</TableCell>
							<TableCell>{t("orders.total")}</TableCell>
							<TableCell>{t("orders.payment")}</TableCell>
							<TableCell>{t("orders.fulfillment")}</TableCell>
							<TableCell>{t("orders.tracking")}</TableCell>
							<TableCell />
						</TableRow>
					</TableHead>
					<TableBody>
						{orders.map((order) => (
							<TableRow key={order}>
								<TableCell>{order}</TableCell>
								<TableCell>—</TableCell>
								<TableCell>—</TableCell>
								<TableCell>—</TableCell>
								<TableCell>—</TableCell>
								<TableCell>—</TableCell>
								<TableCell>
									<Button variant="text" size="small" href={`/orders/${order}`}>
										→
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TablePaginationShell>
		</div>
	);
}
