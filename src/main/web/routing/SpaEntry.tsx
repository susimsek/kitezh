"use client";

import dynamic from "next/dynamic";

// Runtime routes and locale detection belong to the browser, not the static exporter.
const SpaApplication = dynamic(() => import("./SpaApplication"), { ssr: false });

export function SpaEntry() {
  return <SpaApplication />;
}
