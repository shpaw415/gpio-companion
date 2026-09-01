import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ColorModeProvider } from "./color-mode";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("root missing");
}
createRoot(root).render(
	<StrictMode>
		<ColorModeProvider>
			<App />
		</ColorModeProvider>
	</StrictMode>,
);
