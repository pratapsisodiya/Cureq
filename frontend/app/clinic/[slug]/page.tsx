'use client';

import React, { use, useState, useEffect } from 'react';
import { apiRequest } from '../../../src/utils/api';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Clock, CheckCircle2, ChevronRight, AlertCircle, 
  User, ShieldAlert, Phone, Sparkles
} from 'lucide-react';

interface ClinicParams {
  slug: string;
}

export default function PublicClinicBooking({ params }: { params: Promise<ClinicParams> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const router = useRouter();

  const [clinicData, setClinicData] = useState<any>(null);
  const [branchId, setBranchId] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [loading, setLoading] = useState(true);

  // Booking states
  const [selectedDate, setSelectedDate] = useState('');
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [visitType, setVisitType] = useState('NEW');

  // Check-in states
  const [checkinPhone, setCheckinPhone] = useState('');
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [checkinMessage, setCheckinMessage] = useState('');
  const [checkinError, setCheckinError] = useState('');

  // UI status
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Next 7 days list for datepicker
  const getNext7Days = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      
      dates.push({
        formatted: `${yyyy}-${mm}-${dd}`,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        month: d.toLocaleDateString('en-US', { month: 'short' })
      });
    }
    return dates;
  };
  const calendarDates = getNext7Days();

  // 1. Initial sandbox load
  useEffect(() => {
    async function loadPublicClinic() {
      let savedClinicId = localStorage.getItem('cureq_clinic_id') || '';
      
      if (!savedClinicId) {
        // Create demo clinic so public page doesn't crash
        try {
          const mockAdmin = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Booking Admin',
              email: `booking_${Math.round(Math.random()*1000)}@cureq.com`,
              password: 'DemoPassword123!',
              phone: `90003${Math.round(Math.random()*90000)}`,
            }),
          });
          localStorage.setItem('cureq_token', mockAdmin.token);

          const mockOnboard = await apiRequest('/auth/onboard', {
            method: 'POST',
            body: JSON.stringify({
              clinicName: 'CureQ Specialized Dental Care',
              speciality: 'Dentist, General Physician',
              doctors: [
                { name: 'Dr. Suresh Sharma', email: `suresh_${Math.round(Math.random()*1000)}@cureq.com`, speciality: 'Dentist', phone: '9888833331' }
              ]
            }),
          });
          savedClinicId = mockOnboard.clinic.id;
          localStorage.setItem('cureq_clinic_id', savedClinicId);
        } catch (err) {
          console.error(err);
        }
      }

      if (savedClinicId) {
        try {
          const res = await apiRequest(`/clinics/${savedClinicId}`);
          setClinicData(res.clinic);
          const firstBranch = res.clinic.branches[0];
          if (firstBranch) {
            setBranchId(firstBranch.id);
            // Parse doctors list
            const docs: any[] = [];
            firstBranch.schedules.forEach((s: any) => {
              if (!docs.some(d => d.id === s.doctor.id)) {
                docs.push(s.doctor);
              }
            });
            setDoctors(docs);
            if (docs.length > 0) {
              setSelectedDocId(docs[0].id);
            }
          }
          setSelectedDate(calendarDates[0].formatted);
          setLoading(false);
        } catch (err) {
          console.error(err);
          setLoading(false);
        }
      }
    }

    loadPublicClinic();
  }, []);

  // 2. Fetch available timeslots when date or doctor selection changes
  useEffect(() => {
    async function loadSlots() {
      if (!selectedDocId || !branchId || !selectedDate) return;
      try {
        const res = await apiRequest(`/appointments/slots?doctorId=${selectedDocId}&branchId=${branchId}&date=${selectedDate}`);
        setTimeSlots(res.slots || []);
        setSelectedSlot('');
      } catch (err) {
        console.error(err);
      }
    }
    loadSlots();
  }, [selectedDocId, branchId, selectedDate]);

  // 3. Submit Appointment booking
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!selectedSlot) {
      setErrorMessage('Please pick an available time slot.');
      return;
    }

    try {
      // Create patient session
      const pResponse = await apiRequest('/auth/patient-login', {
        method: 'POST',
        body: JSON.stringify({
          phone: patientPhone,
          name: patientName,
          age: patientAge,
          gender: patientGender,
        }),
      });

      const res = await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          timeSlot: selectedSlot,
          type: visitType,
          patientId: pResponse.user.id,
          doctorId: selectedDocId,
          branchId,
        }),
      });

      setBookingDetails({
        ...res.appointment,
        doctorName: doctors.find(d => d.id === selectedDocId)?.user.name,
        patientName,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Booking failed.');
    }
  };

  // 4. Appointment Check-In (Converts to live queue token)
  const handleCheckinLookup = async () => {
    setCheckinError('');
    setCheckinMessage('');
    
    if (checkinPhone.length < 10) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await apiRequest(`/appointments/${clinicData.id}?branchId=${branchId}&date=${todayStr}`);
      const myBookings = res.appointments?.filter((a: any) => a.patient.phone === checkinPhone && a.status === 'BOOKED') || [];

      if (myBookings.length === 0) {
        setCheckinError('No pending bookings found for today with this phone number.');
        return;
      }

      setTodayAppointments(myBookings);
    } catch (err: any) {
      setCheckinError(err.message || 'Error checking for appointments.');
    }
  };

  const executeCheckin = async (appt: any) => {
    try {
      const tokenRes = await apiRequest(`/queues/${branchId}/token`, {
        method: 'POST',
        body: JSON.stringify({
          doctorId: appt.doctorId,
          patientPhone: appt.patient.phone,
          patientName: appt.patient.name,
          type: 'GENERAL',
          visitType: appt.type,
          appointmentId: appt.id,
        }),
      });

      setCheckinMessage(`Check-in successful! Your live token is: ${tokenRes.token.tokenNo}. Redirecting to live tracker...`);
      setTodayAppointments([]);
      setCheckinPhone('');

      setTimeout(() => {
        router.push(`/queue/${tokenRes.token.id}`);
      }, 2500);
    } catch (err: any) {
      setCheckinError(err.message || 'Check-in conversion failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1516] flex items-center justify-center text-xs text-gray-400 font-light">
        Opening clinic portal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1516] text-gray-100 p-4 md:p-8 font-sans selection:bg-[#01696f] selection:text-white">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Banner header */}
        <div className="text-center bg-[#111e20] p-6 border border-[#1c2e31] rounded-[6px]">
          <span className="text-[10px] text-[#01696f] font-semibold uppercase tracking-widest block">Welcome to portal of</span>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#01696f] mt-1">{clinicData.name}</h1>
          <p className="text-xs text-gray-400 font-light mt-1 uppercase">Speciality: {clinicData.speciality}</p>
        </div>

        {isSuccess ? (
          <div className="bg-[#111e20] border-2 border-emerald-500 rounded-[6px] p-8 text-center space-y-6 max-w-lg mx-auto">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
            <h2 className="font-serif text-2xl font-bold">Appointment Booked!</h2>
            
            <div className="space-y-2 text-xs text-left bg-[#0d1516] p-4 rounded border border-[#1c2e31]">
              <p><strong>Patient:</strong> {bookingDetails.patientName}</p>
              <p><strong>Doctor:</strong> {bookingDetails.doctorName}</p>
              <p><strong>Date:</strong> {bookingDetails.date}</p>
              <p><strong>Scheduled Slot Time:</strong> {bookingDetails.timeSlot}</p>
            </div>

            <p className="text-xs text-gray-400 font-light">
              On the day of your appointment, visit this page or scan the QR code at clinic entrance to check in. Check-in converts your slot into a live queue token.
            </p>
            
            <button
              onClick={() => setIsSuccess(false)}
              className="px-6 py-2 bg-[#01696f] text-white text-xs font-semibold rounded-[4px] hover:bg-[#005459] cursor-pointer"
            >
              Book Another Appointment
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            
            {/* Booking Column (2/3 width) */}
            <div className="md:col-span-2 bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] space-y-6">
              <h2 className="text-sm font-semibold text-[#01696f] border-b border-[#1c2e31] pb-2">
                1. Book a Virtual / In-Clinic Slot
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-medium">Select Consulting Doctor</label>
                  <select 
                    value={selectedDocId} 
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                  >
                    {doctors.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.user.name} ({doc.speciality})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-medium">Consultation Type</label>
                  <select 
                    value={visitType} 
                    onChange={(e) => setVisitType(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                  >
                    <option value="NEW">New Patient consultation</option>
                    <option value="FOLLOW_UP">Follow-Up check</option>
                    <option value="EMERGENCY">Emergency OPD visit</option>
                  </select>
                </div>
              </div>

              {/* Custom Date selection list */}
              <div>
                <label className="block text-[10px] text-gray-400 font-medium mb-2">Select Date</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {calendarDates.map((date) => {
                    const active = selectedDate === date.formatted;
                    return (
                      <button
                        key={date.formatted}
                        type="button"
                        onClick={() => setSelectedDate(date.formatted)}
                        className={`flex flex-col items-center p-2.5 min-w-[64px] border rounded-[4px] text-center transition-all cursor-pointer ${
                          active 
                            ? 'bg-[#01696f] text-white border-[#01696f]' 
                            : 'bg-[#111e20] border-[#1c2e31] hover:bg-[#0d1516] text-gray-100'
                        }`}
                      >
                        <span className="text-[9px] uppercase tracking-widest opacity-80">{date.dayName}</span>
                        <span className="text-sm font-bold my-0.5">{date.dayNum}</span>
                        <span className="text-[8px] uppercase tracking-wider opacity-85">{date.month}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot picker grid */}
              <div>
                <label className="block text-[10px] text-gray-400 font-medium mb-3">Pick available slot time</label>
                {timeSlots.length === 0 ? (
                  <p className="text-xs text-red-400 font-light flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> Doctor not consulting on this date. Please pick another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={`py-2 text-center text-xs font-semibold rounded-[4px] border transition-all ${
                          !slot.available
                            ? 'bg-[#0d1516] border-[#1c2e31] text-gray-500 cursor-not-allowed'
                            : selectedSlot === slot.time
                              ? 'bg-[#01696f] text-white border-[#01696f] cursor-pointer'
                              : 'bg-[#111e20] border-[#1c2e31] hover:border-[#01696f] text-gray-100 cursor-pointer'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Booking inputs form */}
              <form onSubmit={handleBookingSubmit} className="space-y-4 border-t border-[#1c2e31] pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-medium">Patient Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-medium">WhatsApp / Contact Phone</label>
                    <input
                      type="text"
                      required
                      placeholder="9998887770"
                      maxLength={10}
                      className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-medium">Age</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 28"
                      className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-medium">Gender</label>
                    <select
                      className="mt-1 block w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none focus:border-[#01696f] text-gray-100"
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {errorMessage && <p className="text-xs text-red-400">{errorMessage}</p>}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#01696f] text-white text-xs font-semibold rounded-[4px] hover:bg-[#005459] transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> Book Appointment Slot
                </button>
              </form>

            </div>

            {/* Right check-in column (1/3 width) */}
            <div className="bg-[#111e20] border border-[#1c2e31] p-6 rounded-[6px] h-fit space-y-4">
              <h2 className="text-sm font-semibold text-[#01696f] border-b border-[#1c2e31] pb-2">
                2. On-the-day Check-In
              </h2>

              <p className="text-xs text-gray-400 font-light leading-relaxed">
                If you have an online booking scheduled for today, enter your phone number to check-in virtually and get your token.
              </p>

              <div>
                <label className="block text-[10px] text-gray-400 font-medium">Registered Phone Number</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Enter phone"
                    className="w-full px-3 py-1.5 border border-[#1c2e31] rounded-[4px] bg-[#0d1516] text-xs focus:outline-none text-gray-100"
                    value={checkinPhone}
                    onChange={(e) => setCheckinPhone(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleCheckinLookup}
                    className="px-3 bg-[#0d1516] hover:bg-[#1c2e31] text-xs rounded border border-[#1c2e31] text-gray-200 font-semibold cursor-pointer"
                  >
                    Check
                  </button>
                </div>
              </div>

              {checkinError && <p className="text-[10px] text-red-400">{checkinError}</p>}
              {checkinMessage && <p className="text-[10px] text-emerald-400 font-medium">{checkinMessage}</p>}

              {/* Show matching bookings to select for check-in */}
              {todayAppointments.map((appt) => (
                <div 
                  key={appt.id} 
                  className="p-3 border border-[#01696f] bg-[#01696f]/10 rounded-[4px] space-y-3"
                >
                  <div className="text-[10px] leading-relaxed">
                    <strong>Doctor:</strong> {appt.doctor.user.name} <br />
                    <strong>Slot Time:</strong> {appt.timeSlot} <br />
                    <strong>Patient:</strong> {appt.patient.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => executeCheckin(appt)}
                    className="w-full py-1 bg-[#01696f] text-white text-[10px] font-semibold rounded-[2px] hover:bg-[#005459] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Confirm Check-In & Get Token <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
