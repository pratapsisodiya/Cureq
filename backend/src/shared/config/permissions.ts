import { Role } from '@prisma/client';

export enum Permission {
  MANAGE_CLINIC = 'MANAGE_CLINIC',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_QUEUE = 'MANAGE_QUEUE',
  VIEW_PATIENTS = 'VIEW_PATIENTS',
  MANAGE_BILLING = 'MANAGE_BILLING',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  CREATE_APPOINTMENT = 'CREATE_APPOINTMENT',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN'
}

export const RolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    Permission.SYSTEM_ADMIN,
    Permission.MANAGE_CLINIC,
    Permission.MANAGE_USERS,
    Permission.MANAGE_QUEUE,
    Permission.VIEW_PATIENTS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_ANALYTICS,
    Permission.CREATE_APPOINTMENT,
  ],
  CLINIC_ADMIN: [
    Permission.MANAGE_CLINIC,
    Permission.MANAGE_USERS,
    Permission.MANAGE_QUEUE,
    Permission.VIEW_PATIENTS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_ANALYTICS,
    Permission.CREATE_APPOINTMENT,
  ],
  DOCTOR: [
    Permission.MANAGE_QUEUE,
    Permission.VIEW_PATIENTS,
    Permission.CREATE_APPOINTMENT,
  ],
  PATIENT: [
    Permission.CREATE_APPOINTMENT,
  ],
};

export const hasPermission = (role: Role, requiredPermission: Permission): boolean => {
  const permissions = RolePermissions[role] || [];
  return permissions.includes(requiredPermission) || permissions.includes(Permission.SYSTEM_ADMIN);
};
