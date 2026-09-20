import Button from "@shpaw415/mui-lite/Button";
import { navigate } from "frame-master-plugin-apply-react/utils";
import type { ReactNode } from "react";
import { useAdminDemo } from "../hooks/useAdminDemo.tsx";
import { useT } from "../hooks/useLocale.tsx";
import AdminGate from "./AdminGate.tsx";
import AdminTabs from "./AdminTabs.tsx";

export type AdminSectionValue =
	| "overview"
	| "products"
	| "inventory"
	| "orders"
	| "shipping"
	| "policies";

export default function AdminSection({
	value,
	children,
}: {
	value: AdminSectionValue;
	children: ReactNode;
}) {
	const t = useT();
	const admin = useAdminDemo();
	const items = [
		{ value: "products", label: t("admin.products") },
		{ value: "inventory", label: t("admin.inventory") },
		{ value: "orders", label: t("admin.orders") },
		{ value: "shipping", label: t("admin.shipping") },
		{ value: "policies", label: t("admin.policies") },
	];
	return (
		<div>
			<AdminGate
				isAdmin={admin.isAdmin}
				signInSlot={
					<div>
						<p style={{ color: "var(--market-muted)", fontSize: ".85rem" }}>
							{t("admin.demoNote")}
						</p>
						<Button variant="contained" onClick={admin.enable}>
							{t("admin.demoUnlock")}
						</Button>
					</div>
				}
			>
				<div className="bar market-admin-bar">
					<Button variant="text" size="small" onClick={admin.disable}>
						{t("admin.demoLock")}
					</Button>
				</div>
				{value === "overview" ? null : (
					<AdminTabs
						value={value}
						items={items}
						onChange={(next) => {
							navigate(`/admin/${next}`);
						}}
					/>
				)}
				{children}
			</AdminGate>
		</div>
	);
}
