import type { Metadata } from "next";
import { Space_Grotesk, Spectral } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const heading = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"]
});

const body = Spectral({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Inspiration",
  description: "An omni-channel knowledge agent for grounded memory, synthesis, and inspired recall."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${body.variable} antialiased`}>{children}</body>
    </html>
  );
}
