import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grounded Listings Assistant",
  description: "Recommends only from a fixed local-listings dataset.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
