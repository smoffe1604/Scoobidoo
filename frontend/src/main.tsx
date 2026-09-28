import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import Home from "./Home";
import "./index.css";

const App = lazy(() => import("./App"));
const Sydbank = lazy(() => import("./Sydbank"));
const SydbankSovs = lazy(() => import("./SydbankSovs"));
const path = window.location.pathname.replace(/\/$/, "");

function Root() {
  if (path === "/envira" || path.startsWith("/envira/")) return <App />;
  if (path === "/sydbank") return <Sydbank />;
  if (path === "/sydbank_sovs") return <SydbankSovs />;
  return <Home />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </React.StrictMode>,
);
