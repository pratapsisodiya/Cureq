# CureQ AI-Powered Clinic Operations Platform — Context & Architecture (LLM Instructions)

Welcome to **CureQ** (also referred to as **Clinically**), a highly optimized, real-time clinic operations SaaS platform. It streamlines doctor-patient-receptionist workflows by substituting legacy physical paper/token systems with a modern real-time queue.

This file serves as a comprehensive system overview, architectural guide, and technical blueprint to assist **Claude** (and other advanced AI assistants) in rapidly understanding the codebase, database structure, and integration patterns.

---

## 🛠️ Complete Tech Stack

### Frontend Architecture
- **Framework:** Next.js 16 (App Router with Server & Client components)
- **State Management:** Zustand 5+ (Optimized for real-time state synchronization)
- **UI & Layout:** React 19, Tailwind CSS v4, Lucide React
- **Real-Time Data Sync:** Socket.io-client
- **Authentication:** Clerk
- **Charts & Reports:** Recharts (Dynamic Bar/Area Charts), browser PDF & CSV print wrappers

### Backend Architecture
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express
- **ORM & Database:** Prisma 6+ interfacing with PostgreSQL (Neon Serverless instance)
- **Caching:** Memory-Cache (Used to buffer query latency and AI predictions)
- **Real-Time Gateway:** Socket.io Server
- **Security:** JWT Authentication (fallback/custom routes), bcryptjs

---

## 📂 Codebase File Structure

```text
Clinically/
├── backend/                        # Node.js + Express Server
│   ├── prisma/                     # Prisma Database Config & Schema
│   │   ├── schema.prisma           # PostgreSQL Data Model declarations
│   │   └── dev.db                  # Local sqlite fallback (if configured)
│   ├── src/
│   │   ├── middleware/             # Express middlewares (Auth, validation)
│   │   ├── routes/                 # REST Route controllers
│   │   │   ├── auth.routes.ts         # User auth & login verification
│   │   │   ├── clinic.routes.ts       # Clinic registration & seat limits
│   │   │   ├── queue.routes.ts        # The core queue manager logic
│   │   │   ├── appointment.routes.ts  # Appointments checking & bookings
│   │   │   ├── patient.routes.ts      # Patient profiles and history lookup
│   │   │   ├── analytics.routes.ts    # Efficiency, peak grids & charts data
│   │   │   ├── notification.routes.ts # Loggers for SMS / WhatsApp alerts
│   │   │   ├── features.routes.ts     # Feature toggles and configurations
│   │   │   └── ai.routes.ts           # Speech and LLM endpoint routes
│   │   ├── services/               # Core business services
│   │   │   ├── ai.service.ts          # NLP Copilot, SOAP Notes, Triage calculations
│   │   │   └── cache.service.ts       # Performance optimizing cache layers
│   │   ├── sockets/                # Socket.io Room setups & callbacks
│   │   │   └── queue.socket.ts        # Dynamic socket rooms for branches
│   │   └── server.ts               # Express entrypoint & listener configuration
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/                       # Next.js 16 App
    ├── app/                        # App Router Root
    │   ├── globals.css             # Root Tailwind CSS variables
    │   ├── layout.tsx              # App-wide providers (Clerk, Socket, Layouts)
    │   ├── page.tsx                # Public-facing Landing Page
    │   ├── login/                  # Clinic credentials / Sign-in UI
    │   ├── onboarding/             # Multi-step Clinic/Doctor setup wizard
    │   ├── dashboard/              # Reception & Doctor Command Console
    │   ├── display/                # Fullscreen Waiting Room display layout
    │   ├── patient/                # Patient dashboard / History / Rx hub
    │   ├── book/                   # Live appointment Booking UI
    │   ├── waitlist/               # Clinic waitlist management panel
    │   └── settings/               # Account / Subscription manager
    ├── src/
    │   ├── components/             # Reusable UI & Widget components
    │   │   ├── AISoapNotes.tsx        # Voice dictation to Structured Clinical Notes
    │   │   ├── AIPatientBrief.tsx     # One-sentence medical background summaries
    │   │   ├── AITriage.tsx           # Urgency classification analyzer
    │   │   ├── AIOutbreakAlert.tsx    # Disease outbreak and anomaly checker
    │   │   ├── AIFollowupMessage.tsx  # Dynamic recommendation writer
    │   │   ├── VoiceDictation.tsx     # Web Speech Audio Synthesizer widget
    │   │   ├── PWAInstaller.tsx       # Prompt widget for local installation
    │   │   ├── UserGuide.tsx          # Step-by-step interactive onboarding guide
    │   │   └── Toast.tsx              # Custom popup notifier
    │   ├── store/
    │   │   └── useQueueStore.ts       # Unified Zustand store for Live Queues
    │   └── utils/
    │       ├── api.ts                 # Fetch middleware configuration
    │       └── useClerkSync.ts        # Syncer between Clerk Auth and Prisma
    └── package.json
```

---

## 🗄️ Database Schema & Models (`schema.prisma`)

The PostgreSQL database acts as the single source of truth. Relationships are constructed using strict foreign keys. Refer to the key models when designing new entities:

### Enums
- `Role`: `SUPER_ADMIN`, `CLINIC_ADMIN`, `DOCTOR`, `PATIENT`
- `TokenStatus`: `WAITING` (currently in waiting area), `IN_CONSULTATION` (with the doctor), `SERVED` (completed), `SKIPPED` (temporarily bypassed), `NO_SHOW` (missed call)
- `SeatStatus`: `SEATED`, `WAITING_OUTSIDE` (allocated dynamically based on branch capacity limits)
- `TokenType`: `GENERAL`, `PRIORITY`, `EMERGENCY`
- `VisitType`: `NEW`, `FOLLOW_UP`, `EMERGENCY`
- `AppointmentStatus`: `BOOKED`, `CHECKED_IN`, `CANCELLED`
- `SubscriptionPlan`: `FREE`, `STARTER`, `PRO`, `CHAIN`
- `NotificationChannel`: `SMS`, `WHATSAPP`

### Core Database Entities
1. **User**: Authenticable profile. Links to either one Clinic (if admin), one DoctorProfile (if doctor), or queues of tokens (if patient).
2. **Clinic**: The primary tenant. Has one Admin User, a subscription plan, and owns multiple branches.
3. **Branch**: Physical location. Holds a configurable capacity of `waitingSeats`.
4. **DoctorProfile**: Links to a `User` record with role `DOCTOR`. Manages working schedules.
5. **DoctorSchedule**: Map of availability per branch. Contains `dayOfWeek` (0-6), `startTime`, `endTime`, `slotDuration`, `maxPatients`, and `bufferTime`.
6. **Token**: Represents a queue position. Holds a specific alphanumeric code (e.g., `GP-012`), status details, and references to patient, doctor, and branch. Includes `seatStatus` (`SEATED` / `WAITING_OUTSIDE`).
7. **Appointment**: Slots booked in advance. Can transition to a `Token` upon receptionist check-in.
8. **VisitLog**: Permanent history logs. Contains rating feedback, clinical notes, and diagnosis.
9. **WaitlistEntry**: Backlog entries for days when the doctor's queue is fully saturated.

---

## 📶 Real-Time WebSockets (`Socket.io`)

Real-time synchronization ensures receptionists, doctors, and smart TV monitors remain synchronized without page reloads.

### Socket Rooms
Sockets join room-channels mapped to specific Branches:
- **Event to Join:** `newSocket.emit('join:branch', branchId)`

### Event Listeners (Frontend)
- `queue:updated`: Dispatched whenever a token is added, served, skipped, called, or reordered. Payloads contain the active list of `TokenItem` arrays.
- `token:called`: Triggers browser Text-to-Speech (TTS) synthesizer aloud (`"Token GP-003, please proceed..."`).
- `broadcast:alert`: Broadcasts an administrative alert or critical clinic banner.
- `doctor:break`: Notifies dashboard/TV display if a doctor goes on break, updating UI with estimated return time.

---

## 🧠 Zustand State Management (`useQueueStore.ts`)

The frontend uses a single Zustand store to manage real-time queues. If you need to interface with or update active queues, use `useQueueStore`.

### State Properties
- `activeQueue`: `TokenItem[]` (Patients waiting or currently in consultation)
- `servedToday`: `TokenItem[]`
- `skippedToday`: `TokenItem[]`
- `noShowToday`: `TokenItem[]`
- `doctorBreakStatus`: `Record<string, DoctorBreakInfo>` (Doctor IDs linked to their current rest schedules)
- `lastCalledToken`: `{ tokenNo: string, doctorName: string }`

### Actions
- `fetchQueue(branchId, doctorId)`: Refreshes local queues from backend REST endpoints.
- `initSocket(branchId)`: Initiates socket connection and hooks room event listeners.
- `callNext(branchId, doctorId, notes?, followUpDate?)`: Calls the next waiting patient, auto-completing the active one.
- `skipToken(branchId, doctorId, tokenId)`: Shifts status to skipped.
- `markNoShow(branchId, doctorId, tokenId)`: Shifts status to no-show.
- `reorderQueue(branchId, doctorId, tokenIds[])`: Saves custom drag-and-drop or prioritized walk-in sequences.
- `updateSeatsCapacity(clinicId, branchId, seats)`: Modifies branch maximum physical chair limits.

---

## ⚡ AI Copilot & Core Algorithms

CureQ features deep AI integration (`backend/src/services/ai.service.ts`):
1. **AI Copilot Panel (Light-Themed UI):** Uses LLM chains to analyze clinic metrics. Supports queries like *"Analyze patient traffic trends"* or *"Suggest schedule fixes to minimize no-shows"*.
2. **AI SOAP Notes Generator:** Converts clinical voice transcripts from speech-to-text directly into structured clinical records (Subjective, Objective, Assessment, Plan).
3. **AI Triage System:** Scans the patient's chief complaints on entry and rates urgency (`1-5`) to alert the receptionist of critical cases.
4. **AI Outbreak Detector:** Evaluates recent visit history to search for abnormal clusters of identical symptoms, notifying the clinic of possible epidemic outbreaks.

---

## 🛠️ Local Development & Environment Config

### Backend Configuration (`backend/.env`)
```env
PORT=5000
DATABASE_URL="postgresql://<username>:<password>@<host>/<database>?sslmode=require"
JWT_SECRET="generate_a_secure_random_hash"
OPENAI_API_KEY="your_openai_api_key_for_copilot" # Or Gemini API Key
NODE_ENV="development"
```

### Frontend Configuration (`frontend/.env`)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your_clerk_pub_key"
CLERK_SECRET_KEY="your_clerk_secret_key"
NEXT_PUBLIC_BACKEND_URL="http://localhost:5000"
```

### Developer Commands
* **Start Backend:**
  ```bash
  cd backend
  npm install
  npx prisma db push # To sync database schemas
  npm run dev
  ```
* **Start Frontend:**
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

---

## 💡 Guidelines & Coding Patterns for Claude

When writing, refactoring, or extending code within the CureQ codebase, adhere strictly to these principles:

1. **Type Safety First:** Keep frontend components in `.tsx` and backend routers in `.ts`. Avoid using `any` type tags; instead, create custom interfaces or extend Prisma types.
2. **Keep Business Logic in Services:** Do not clutter route controllers (`routes/`) with large algorithms or database calls. Instead, declare them in modular service files.
3. **Handle WebSocket Sync Correctly:** When updating queue statuses (e.g. Call, Skip, Reorder), remember that the backend controller updates the database and immediately broadcasts the `queue:updated` event to the socket room. Let the socket listener in `useQueueStore` do the frontend update. Avoid returning huge REST payloads to overwrite state manually on the frontend client.
4. **CSS v4 + Tailwind Compliance:** Use standard Tailwind utility classes inside React JSX files. Keep the layout responsive, modern, premium, and interactive with transitions/hovers. Avoid inline styles where possible.
5. **Zustand Usage:** Do not instantiate multiple WebSocket channels or stores for queues. Always import `useQueueStore` to gain instant access to active room states.

---
*Created dynamically for Claude to maintain a premium standard of context and implementation.*
