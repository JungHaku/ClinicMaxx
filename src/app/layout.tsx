import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ClinicMaxx",
    template: "%s · ClinicMaxx",
  },
  description:
    "Practice management for multi-disciplinary clinics — scheduling, charting, billing and online booking in one place.",
};

export const viewport: Viewport = {
  themeColor: "#12615c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
