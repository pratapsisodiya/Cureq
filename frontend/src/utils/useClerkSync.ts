import { useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { apiRequest } from './api';

export function useClerkSync() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function sync() {
      // If Clerk is not loaded, keep syncing = true
      if (!isLoaded) return;

      // If user is not signed in, we can stop syncing
      if (!isSignedIn || !user) {
        setSyncing(false);
        return;
      }

      const token = localStorage.getItem('cureq_token');
      if (token) {
        try {
          // Verify existing token works by calling /me
          const meRes = await apiRequest('/auth/me');
          const meUser = meRes.user;

          // Make sure we have the clinicId/branchId in localStorage if they exist in DB
          if (meUser.role === 'CLINIC_ADMIN') {
            if (meUser.clinicAdmin) {
              localStorage.setItem('cureq_clinic_id', meUser.clinicAdmin.id);
              const firstBranch = meUser.clinicAdmin.branches?.[0];
              if (firstBranch) {
                localStorage.setItem('cureq_branch_id', firstBranch.id);
              }
            }
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/doctor')) {
              router.push('/dashboard/reception');
            }
          } else if (meUser.role === 'DOCTOR') {
            if (meUser.doctorProfile) {
              localStorage.setItem('cureq_active_doctor_id', meUser.doctorProfile.id);
              const firstSchedule = meUser.doctorProfile.schedules?.[0];
              if (firstSchedule?.branch) {
                localStorage.setItem('cureq_branch_id', firstSchedule.branch.id);
                if (firstSchedule.branch.clinicId) {
                  localStorage.setItem('cureq_clinic_id', firstSchedule.branch.clinicId);
                }
              }
            }
            if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/reception')) {
              router.push('/dashboard/doctor');
            }
          }

          setSyncing(false);
          return;
        } catch (err) {
          // Token is invalid/expired, clear it and proceed to re-sync
          localStorage.removeItem('cureq_token');
        }
      }

      // Sync with backend
      try {
        const email = user.primaryEmailAddress?.emailAddress;
        const name = user.fullName || user.username || 'User';
        const phone = user.primaryPhoneNumber?.phoneNumber || '';

        const syncRes = await apiRequest('/auth/clerk-sync', {
          method: 'POST',
          body: JSON.stringify({ email, name, phone }),
        });

        localStorage.setItem('cureq_token', syncRes.token);
        localStorage.setItem('cureq_role', syncRes.user.role);

        // Fetch full user context to set clinic and branch IDs
        const meRes = await apiRequest('/auth/me');
        const meUser = meRes.user;

        if (meUser.role === 'CLINIC_ADMIN') {
          if (meUser.clinicAdmin) {
            localStorage.setItem('cureq_clinic_id', meUser.clinicAdmin.id);
            const firstBranch = meUser.clinicAdmin.branches?.[0];
            if (firstBranch) {
              localStorage.setItem('cureq_branch_id', firstBranch.id);
            }
          }
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/doctor')) {
            router.push('/dashboard/reception');
          }
        } else if (meUser.role === 'DOCTOR') {
          if (meUser.doctorProfile) {
            localStorage.setItem('cureq_active_doctor_id', meUser.doctorProfile.id);
            const firstSchedule = meUser.doctorProfile.schedules?.[0];
            if (firstSchedule?.branch) {
              localStorage.setItem('cureq_branch_id', firstSchedule.branch.id);
              if (firstSchedule.branch.clinicId) {
                localStorage.setItem('cureq_clinic_id', firstSchedule.branch.clinicId);
              }
            }
          }
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/reception')) {
            router.push('/dashboard/doctor');
          }
        }
      } catch (err: any) {
        console.error('Clerk sync failed:', err);
        setError(err.message || 'Authentication sync failed.');
      } finally {
        setSyncing(false);
      }
    }

    sync();
  }, [isLoaded, isSignedIn, user]);

  return { syncing, error, isSignedIn, user, signOut };
}
