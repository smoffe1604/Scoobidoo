import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const Sydbank = lazy(() => import("./Sydbank"));
const SydbankSovs = lazy(() => import("./SydbankSovs"));
const path = window.location.pathname.replace(/\/$/, "");

function Root() {
  if (path === "/sydbank") return <Sydbank />;
  if (path === "/sydbank_sovs") return <SydbankSovs />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </React.StrictMode>,
);
