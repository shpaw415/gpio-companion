import CatalogTable from "../../components/CatalogTable.tsx";
import { DEMO_CATALOG } from "../../lib/demo-catalog.ts";

export default function KitsPage() {
	return <CatalogTable items={DEMO_CATALOG} />;
}
