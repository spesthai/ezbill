import "antd/dist/reset.css";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./lib/i18n";
import { registerPwa } from "./pwa";
import "./styles.css";

// Force all dayjs operations to use Asia/Bangkok (UTC+7)
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Bangkok");

registerPwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

