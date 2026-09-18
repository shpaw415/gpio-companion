import { TablePagination } from "@shpaw415/mui-lite/Pagination";
import Paper from "@shpaw415/mui-lite/Paper";
import Table, { TableContainer } from "@shpaw415/mui-lite/Table";
import type { ReactNode } from "react";
import { useT } from "../hooks/useLocale.tsx";

export type RowsPerPage = 10 | 25 | 50 | 100;

export default function TablePaginationShell({
	children,
	count,
	page,
	rowsPerPage,
	onPageChange,
	onRowsPerPageChange,
}: {
	children: ReactNode;
	count: number;
	page: number;
	rowsPerPage: RowsPerPage;
	onPageChange: (page: number) => void;
	onRowsPerPageChange: (rows: RowsPerPage) => void;
}) {
	const t = useT();
	return (
		<Paper className="market-table-shell" variant="outlined">
			<TableContainer>
				<Table size="small">{children}</Table>
			</TableContainer>
			<TablePagination
				count={count}
				page={page}
				rowsPerPage={rowsPerPage}
				onPageChange={(_, next) => onPageChange(next)}
				onRowsPerPageChange={onRowsPerPageChange}
				labelRowsPerPage={t("admin.rowsPerPage")}
				labelDisplayedRows={({ from, to, count: total }) =>
					t("admin.displayedRows", { from, to, count: total })
				}
				getItemAriaLabel={(type) =>
					type === "next" ? t("action.next") : t("action.previous")
				}
			/>
		</Paper>
	);
}
