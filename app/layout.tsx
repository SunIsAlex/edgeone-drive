import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EdgeOne Drive",
  description: "Personal cloud drive powered by EdgeOne Pages + Blob Storage",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
