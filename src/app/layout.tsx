import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlayBox OS - Sistem Manajemen Rental PS",
  description: "Aplikasi Operasional & Kasir Rental PlayStation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className="h-full antialiased bg-[#050505] text-white"
    >
      <body className="min-h-full flex flex-col justify-center items-center font-sans">
        <div className="w-full max-w-md min-h-screen bg-playbox-bg relative shadow-[0_0_50px_rgba(0,0,0,0.8)] border-x border-white/5 flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
