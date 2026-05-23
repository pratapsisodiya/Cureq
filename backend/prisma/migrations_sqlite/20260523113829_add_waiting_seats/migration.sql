-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "waitingSeats" INTEGER NOT NULL DEFAULT 10,
    "clinicId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Branch_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Branch" ("address", "clinicId", "createdAt", "id", "name", "phone", "updatedAt") SELECT "address", "clinicId", "createdAt", "id", "name", "phone", "updatedAt" FROM "Branch";
DROP TABLE "Branch";
ALTER TABLE "new_Branch" RENAME TO "Branch";
CREATE TABLE "new_Token" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenNo" TEXT NOT NULL,
    "queueOrder" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "visitType" TEXT NOT NULL DEFAULT 'NEW',
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "chiefComplaint" TEXT,
    "notes" TEXT,
    "estimatedWait" INTEGER NOT NULL,
    "checkInTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startTime" DATETIME,
    "endTime" DATETIME,
    "patientId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "seatStatus" TEXT NOT NULL DEFAULT 'SEATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Token_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Token_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Token_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Token_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Token" ("appointmentId", "branchId", "checkInTime", "chiefComplaint", "createdAt", "doctorId", "endTime", "estimatedWait", "id", "notes", "patientId", "patientName", "patientPhone", "queueOrder", "startTime", "status", "tokenNo", "type", "updatedAt", "visitType") SELECT "appointmentId", "branchId", "checkInTime", "chiefComplaint", "createdAt", "doctorId", "endTime", "estimatedWait", "id", "notes", "patientId", "patientName", "patientPhone", "queueOrder", "startTime", "status", "tokenNo", "type", "updatedAt", "visitType" FROM "Token";
DROP TABLE "Token";
ALTER TABLE "new_Token" RENAME TO "Token";
CREATE UNIQUE INDEX "Token_appointmentId_key" ON "Token"("appointmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
