import type { Metadata } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import "./forms.css";
import "./landing.css";
import "./details.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  icons: { icon: "/app-icon-v2.png", apple: "/app-icon-v2.png" },
  title: {
    default: "Revenue-Intelligence",
    template: "%s | Revenue-Intelligence",
  },
  description:
    "Account risk, expansion opportunities, and customer evidence in one workspace.",
  openGraph: {
    type: "website",
    siteName: "Revenue-Intelligence",
    title: "Revenue-Intelligence",
    description: "Customer evidence. Revenue decisions.",
    images: [
      {
        url: "/og-intelligence.png",
        width: 1733,
        height: 907,
        alt: "Revenue-Intelligence: customer evidence and revenue decisions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Revenue-Intelligence",
    description: "Customer evidence. Revenue decisions.",
    images: ["/og-intelligence.png"],
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
