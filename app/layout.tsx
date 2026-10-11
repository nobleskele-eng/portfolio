import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import "./globals.css";

// Self-hosted with the site and preloaded, rather than a render-blocking
// stylesheet from Google's servers.
const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-ink",
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={garamond.variable}>
      <body>{children}</body>
    </html>
  );
}
