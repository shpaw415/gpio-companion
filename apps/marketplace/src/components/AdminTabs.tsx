import Tabs, { Tab } from "@shpaw415/mui-lite/Tabs";
import { useT } from "../hooks/useLocale.tsx";

export type AdminTabItem = { value: string; label: string; disabled?: boolean };

export default function AdminTabs({
	value,
	items,
	onChange,
}: {
	value: string;
	items: AdminTabItem[];
	onChange?: (value: string) => void;
}) {
	const t = useT();
	return (
		<Tabs
			value={value}
			variant="scrollable"
			aria-label={t("admin.tabsLabel")}
			onChange={(_, next) => onChange?.(String(next))}
			className="market-admin-tabs"
		>
			{items.map((item) => (
				<Tab
					key={item.value}
					value={item.value}
					label={item.label}
					disabled={item.disabled}
				/>
			))}
		</Tabs>
	);
}
