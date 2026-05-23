import { ReactDIContext, type WithoutDeps } from "awilixify/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { App } from "./modules/app/App";
import { AppModule } from "./modules/app/app.module";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element not found");
}

const appRootElement = rootElement;

const app = ReactDIContext.create(AppModule);

await app.init();

const AppComponent = app.scope.resolve<WithoutDeps<typeof App>>("App");

createRoot(appRootElement).render(
	<StrictMode>
		<AppComponent />
	</StrictMode>,
);
