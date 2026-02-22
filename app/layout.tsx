import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/ThemeContext";
import { LayoutProvider } from "@/lib/LayoutContext";
import { AlertsProvider } from "@/lib/alerts-context";
import TopBar from "@/components/TopBar";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Flow Terminal — Smart money flow intelligence",
  description: "Whales, Congress, insiders, news, filings, earnings. One hub for traders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased font-sans">
        <ThemeProvider>
          <LayoutProvider>
            <AlertsProvider>
              <TopBar />
              <main className="px-6 py-5">{children}</main>
            </AlertsProvider>
          </LayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
