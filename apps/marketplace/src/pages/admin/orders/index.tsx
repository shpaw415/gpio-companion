import { GET, PATCH } from "@api/admin/orders";
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
import { useCallback, useEffect, useState } from "react";
import AdminSection from "../../../components/AdminSection.tsx";
import TablePaginationShell, {
	type RowsPerPage,
} from "../../../components/TablePaginationShell.tsx";
import { useT } from "../../../hooks/useLocale.tsx";
import type { FulfillmentStatus } from "../../../lib/db/schema.ts";

type AdminOrder = Awaited<ReturnType<typeof GET>>[number];

export default function AdminOrdersPage() {
	const t = useT();
	const [rows, setRows] = useState<AdminOrder[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState("");
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState<RowsPerPage>(10);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setRows(await GET());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	async function transition(id: string, fulfillmentStatus: FulfillmentStatus) {
		setError(null);
		try {
			await PATCH(id, { fulfillmentStatus });
			await reload();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}

	const q = filter.trim().toLowerCase();
	const filtered = rows.filter((order) => {
		if (!q) return true;
		return `${order.id} ${order.orderNumber} ${order.email}`
			.toLowerCase()
			.includes(q);
	});
	const visible = filtered.slice(
		page * rowsPerPage,
		page * rowsPerPage + rowsPerPage,
	);

	return (
		<AdminSection value="orders">
			<Typography variant="h4" component="h1">
				{t("admin.orders")}
			</Typography>
			{error ? (
				<Paper variant="outlined" style={{ padding: "0.8rem 1.2rem" }}>
					<Typography color="error">{error}</Typography>
				</Paper>
			) : null}
			<div className="bar market-catalog-toolbar">
				<input
					className="market-catalog-search"
					placeholder={t("admin.filterPlaceholder")}
					aria-label={t("admin.filterPlaceholder")}
					value={filter}
					onChange={(event) => {
						setFilter(event.target.value);
						setPage(0);
					}}
				/>
			</div>
			{loading ? (
				<Typography color="textSecondary">{t("state.loading")}</Typography>
			) : (
				<TablePaginationShell
					count={filtered.length}
					page={page}
					rowsPerPage={rowsPerPage}
					onPageChange={setPage}
					onRowsPerPageChange={(next) => {
						setRowsPerPage(next);
						setPage(0);
					}}
				>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>ORDER</TableCell>
								<TableCell>PAYPAL</TableCell>
								<TableCell>TOTAL</TableCell>
								<TableCell>FULFILLMENT</TableCell>
								<TableCell />
							</TableRow>
						</TableHead>
						<TableBody>
							{visible.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} style={{ color: "var(--market-muted)" }}>
										{t("admin.emptyOrders")}
									</TableCell>
								</TableRow>
							) : (
								visible.map((order) => (
									<TableRow key={order.id}>
										<TableCell>
											{order.orderNumber}
											<br />
											<span style={{ color: "var(--market-muted)" }}>
												{order.email}
											</span>
										</TableCell>
										<TableCell>{order.paymentStatus}</TableCell>
										<TableCell>
											{(order.totalCents / 100).toFixed(2)} {order.currency}
										</TableCell>
										<TableCell>
											<Chip size="small">{order.fulfillmentStatus}</Chip>
										</TableCell>
										<TableCell>
											{order.fulfillmentStatus === "unfulfilled" ? (
												<Button
													variant="text"
													size="small"
													onClick={() => transition(order.id, "processing")}
												>
													processing →
												</Button>
											) : order.fulfillmentStatus === "processing" ? (
												<Button
													variant="text"
													size="small"
													onClick={() => transition(order.id, "shipped")}
												>
													shipped →
												</Button>
											) : null}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</TablePaginationShell>
			)}
		</AdminSection>
	);
}
