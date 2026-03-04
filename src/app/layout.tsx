import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ancestry Map — Sociotechnical Visualization Engine",
  description:
    "Treat your codebase as a living universe. Visualize developer impact as stars, collaboration as orbital intersections, and microservices as galaxies evolving through time.",
  keywords: [
    "git visualization",
    "codebase analysis",
    "developer analytics",
    "sociotechnical",
    "bus factor",
    "code ownership",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
