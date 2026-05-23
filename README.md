# CureQ - Smart Clinic Queue Management System

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?style=flat-square&logo=socket.io)](https://socket.io/)

**CureQ** is an AI-powered clinic operations platform designed to eliminate crowded waiting rooms. It replaces traditional paper tokens with a modern, real-time ecosystem featuring virtual check-ins, smart TV displays, and AI-driven wait time predictions.

---

## 📸 Screenshots

<div align="center">
  <img src="https://via.placeholder.com/800x450.png?text=CureQ+Landing+Page+Dashboard" alt="CureQ Landing Page" width="800">
  <p><em>Landing Page - AI-Powered Clinic Operations</em></p>
  
  <br />

  <div style="display: flex; justify-content: space-around; gap: 10px;">
    <img src="https://via.placeholder.com/400x250.png?text=Doctor+Console+View" alt="Doctor Console" width="400">
    <img src="https://via.placeholder.com/400x250.png?text=TV+Display+Mode" alt="TV Display" width="400">
  </div>
  <p><em>Doctor Console (Left) and Smart TV Waiting Room Display (Right)</em></p>
</div>

---

## ✨ Key Features

### 🤖 AI Wait Time Predictor
Uses rolling doctor consultation speeds and historical data to provide patients with hyper-accurate ETAs down to the minute. No more "static" token numbers.

### 📺 Smart TV Waiting Room Mode
A dedicated widescreen layout for clinic monitors.
- **Real-time Synchronization:** Updates instantly via WebSockets when a patient is called.
- **Voice Announcements:** Integrated speech synthesis (TTS) to call out token numbers.
- **Live Ticker:** Customizable announcement bar for clinic notices.

### 👨‍⚕️ Doctor Console
A high-productivity dashboard for healthcare providers.
- **One-Click Calling:** Move the queue forward with a single tap.
- **Voice Dictation:** AI-powered speech-to-text for consultation notes and prescriptions.
- **Performance Analytics:** Track average consultation times, patient volume, and no-show rates.

### 📱 Virtual Queue Check-in
- **QR Entry:** Patients can scan a QR code at the entrance to join the queue.
- **Remote Booking:** Check-in from home and track live status on a personal smartphone.
- **WhatsApp Alerts:** Automated notifications for upcoming turns.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS v4
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Real-time:** Socket.io-client
- **Auth:** Clerk
- **Icons:** Lucide React
- **Charts:** Recharts

### Backend
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express
- **Database:** SQLite (via Prisma ORM)
- **Real-time:** Socket.io
- **Validation:** Zod
- **Security:** JWT, bcryptjs

---

## 📂 Project Structure

```text
Clinically/
├── backend/                # Node.js + Express + Prisma
│   ├── prisma/             # Database schema and migrations
│   ├── src/
│   │   ├── routes/         # API endpoints (Auth, Clinic, Queue, etc.)
│   │   ├── services/       # Business logic (AI, Cache)
│   │   ├── sockets/        # Socket.io event handlers
│   │   └── server.ts       # Entry point
│   └── tsconfig.json
│
├── frontend/               # Next.js + Tailwind CSS
│   ├── app/                # App router pages (Doctor, TV Display, Onboarding)
│   ├── src/
│   │   ├── components/     # Reusable UI (Voice Dictation, etc.)
│   │   ├── store/          # Zustand state management
│   │   └── utils/          # API & socket helpers
│   └── tailwind.config.ts
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### 1. Setup Backend
```bash
cd backend
npm install
# Setup .env with DATABASE_URL="file:./dev.db"
npx prisma migrate dev --name init
npm run dev
```

### 2. Setup Frontend
```bash
cd frontend
npm install
# Setup .env with Clerk and Backend URL
npm run dev
```

Visit `http://localhost:3000` to see the landing page.

---

## 💼 Subscription Plans
CureQ is built as a SaaS with multi-tier pricing:
- **Free:** 1 Doctor, 1 Branch, 50 Tokens/day.
- **Starter:** 3 Doctors, SMS Alerts, Shareable Booking Page.
- **Pro:** Unlimited Doctors, WhatsApp Alerts, AI Analytics, TV Mode.
- **Chain:** Multi-branch support, Consolidated Analytics.

---

## 🗺️ Roadmap
- [ ] Mobile App for Patients (iOS/Android).
- [ ] Integration with Pharmacy & Lab modules.
- [ ] Deep Learning models for multi-speciality wait-time estimation.
- [ ] Multi-lingual Voice Announcements.

---

<p align="center">Built with ❤️ for modern healthcare.</p>
