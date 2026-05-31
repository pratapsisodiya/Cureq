import type { Metadata, Viewport } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import PWAInstaller from '../src/components/PWAInstaller';
import dynamic from 'next/dynamic';
import "./globals.css";

const ChatWidget = dynamic(() => import('../src/components/ChatWidget'), { ssr: false });

export const viewport: Viewport = {
  themeColor: '#01696f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "CureQ — Smart Clinic Queue & AI Management",
  description: "Real-time token engine, AI-powered wait-time predictor, smart waiting room TV screens, virtual queues, and automated alerts for modern OPDs.",
  applicationName: 'CureQ',
  keywords: ['clinic', 'queue management', 'OPD', 'doctor', 'appointment', 'AI healthcare'],
  authors: [{ name: 'CureQ' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CureQ',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-72.svg', sizes: '72x72', type: 'image/svg+xml' },
      { url: '/icons/icon-96.svg', sizes: '96x96', type: 'image/svg+xml' },
      { url: '/icons/icon-128.svg', sizes: '128x128', type: 'image/svg+xml' },
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#01696f',
    'msapplication-tap-highlight': 'no',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased">
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="CureQ" />
          <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
          <link rel="apple-touch-startup-image" href="/icons/icon-512.svg" />
          <meta name="msapplication-TileImage" content="/icons/icon-192.svg" />
          <meta name="msapplication-TileColor" content="#01696f" />
        </head>
        <body className="min-h-full flex flex-col">
          {children}
          <PWAInstaller />
          <ChatWidget />
        </body>
      </html>
    </ClerkProvider>
  );
}
