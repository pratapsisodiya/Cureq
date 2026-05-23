import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";

export const metadata: Metadata = {
  title: "CureQ — Smart Doctor Clinic Queue & Appointment SaaS",
  description: "Real-time token engine, AI-powered wait-time predictor, smart waiting room TV screens, virtual queues, and automated alerts for modern OPDs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
