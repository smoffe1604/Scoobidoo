import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const Sydbank = lazy(() => import("./Sydbank"));
const onSydbank = /^\/sydbank\/?$/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {onSydbank ? (
      <Suspense fallback={null}>
        <Sydbank />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
