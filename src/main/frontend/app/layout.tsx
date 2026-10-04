import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./styles.css";
import type { Metadata } from "next";

import { StoreProvider } from "@/store/StoreProvider";
import { BrandingProvider } from "@/components/auth/BrandingProvider";
import { ThemeManager } from "@/components/auth/ThemeManager";
import { loadIcons } from "@/lib/icon-loader";

loadIcons();

// Keep callback query parameters out of the browser's fallback document title.
export const metadata: Metadata = {
  metadataBase: new URL("https://spring-authorization-server-samples.onrender.com"),
  title: "Authorization Server",
  description: "Spring Authorization Server sample application",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Authorization Server",
    description: "Spring Authorization Server sample application",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-bs-theme="light" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body>
        <StoreProvider>
          <BrandingProvider>
            <ThemeManager />
            {children}
          </BrandingProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
