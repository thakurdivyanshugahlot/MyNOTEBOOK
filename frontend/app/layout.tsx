import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import ApiAuthBridge from "@/components/ApiAuthBridge";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Notebook RAG",
  description: "AI-powered research assistant over your own sources",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen">
          <ApiAuthBridge />
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}