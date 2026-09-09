import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Number Grid | Zwelms",
  description: "A structured number grid workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
