import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Rein",
  description: "Repository memory for agents and humans.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
