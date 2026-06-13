'use client';

import React, { useState } from 'react';
import { apiRequest } from '../../../src/utils/api';
import { Activity, User, Phone, FileText, Calendar, Download, Printer, Clock, ChevronRight, ArrowLeft, Heart, Sparkles, LogOut, CheckCircle, X } from 'lucide-react';
import Link from 'next/link';

export default function PatientPortal() {
  const [phone, setPhone] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [visitLogs, setVisitLogs] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest(`/features/patient-portal/${phone}`);
      setPatient(res.patient);
      setVisitLogs(res.visitLogs || []);
      setAppointments(res.appointments || []);
    } catch (err: any) {
      setError(err.message || 'No medical records found for this phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (apptId: string, date: string) => {
    if (!confirm(`Cancel your appointment on ${date}? This cannot be undone.`)) return;
    try {
      await apiRequest(`/appointments/${apptId}/cancel`, { method: 'PATCH' });
      setAppointments(prev => prev.filter(a => a.id !== apptId));
    } catch (err: any) {
      setError(err.message || 'Failed to cancel appointment. Please try again.');
    }
  };

  const handlePrintPrescription = (log: any) => {
    const html = '<html><head><title>Prescription</title><style>' +
      'body{font-family:Segoe UI,sans-serif;padding:40px;color:#1a202c;max-width:700px;margin:0 auto}' +
      'h1{color:#01696f;border-bottom:2px solid #e9e9e7;padding-bottom:10px}' +
      '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0;font-size:13px}' +
      '.label{color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase}' +
      '.rx{background:#fbfbfa;border-left:3px solid #01696f;border-top:1px solid #e9e9e7;border-right:1px solid #e9e9e7;border-bottom:1px solid #e9e9e7;padding:16px;margin-top:16px;white-space:pre-wrap;font-size:13px;border-radius:6px}' +
      'footer{margin-top:40px;font-size:10px;color:#a0aec0;text-align:center;border-top:1px solid #e9e9e7;padding-top:12px}' +
      '</style></head><body>' +
      '<h1>CureQ Digital Prescription</h1>' +
      '<div class="meta"><div><div class="label">Patient</div>' + log.patient?.name + '</div>' +
      '<div><div class="label">Date</div>' + new Date(log.date).toLocaleDateString() + '</div>' +
      '<div><div class="label">Doctor</div>Dr. ' + log.doctorName + ' (' + log.specialty + ')</div>' +
      '<div><div class="label">Token</div>' + log.tokenNo + '</div></div>' +
      '<div class="label">Chief Complaint</div><p>' + (log.chiefComplaint || 'Not recorded') + '</p>' +
      '<div class="label" style="margin-top:12px">Prescription & Notes</div>' +
      '<div class="rx">' + (log.notes || 'No notes recorded') + '</div>' +
      (log.followUpDate ? '<p style="margin-top:12px;color:#01696f;font-size:12px"><strong>Follow-up:</strong> ' + log.followUpDate + '</p>' : '') +
      '<footer>Generated via CureQ Queue Engine — Clinic Use Only</footer></body></html>';
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        w.focus();
        w.print();
      }, 250);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] font-sans selection:bg-[#01696f]/20">
      
      {/* Header */}
      <header className="bg-white border-b border-[#e9e9e7] px-8 py-5 sticky top-0 z-10 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reception" className="p-2 hover:bg-[#f4f4f3] rounded-lg transition-colors text-[#64748b] hover:text-[#1a202c]" aria-label="Go Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-6 w-px bg-[#e9e9e7]"></div>
          <Activity className="h-6 w-6 text-[#01696f]" />
          <div>
            <h1 className="font-serif text-lg font-bold text-[#01696f]">CureQ Patient Portal</h1>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold">Your health records & digital prescriptions</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-[#e6f3f4] text-[#01696f] px-2.5 py-1 rounded border border-[#01696f]/20 font-medium flex items-center gap-1.5 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[#01696f] animate-pulse"></span> Encrypted Session
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {!patient ? (
          /* Phone Lookup Form */
          <div className="max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white border border-[#e9e9e7] rounded-2xl p-8 shadow-sm space-y-6">
              <div className="text-center space-y-3">
                <div className="h-16 w-16 bg-[#e6f3f4] rounded-full flex items-center justify-center mx-auto shadow-xs">
                  <User className="h-8 w-8 text-[#01696f]" />
                </div>
                <h2 className="font-serif text-2xl font-bold tracking-tight text-[#1a202c]">Access Medical Records</h2>
                <p className="text-xs text-[#64748b] font-light leading-relaxed">
                  Enter your registered mobile number to securely view your active queue tokens, doctor prescriptions, and upcoming appointments.
                </p>
              </div>

              <form onSubmit={handleLookup} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-md border border-red-200 text-center font-medium">
                    {error}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="block text-[10px] text-[#64748b] font-bold uppercase tracking-wider">Mobile Number</label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      className="flex-1 px-3.5 py-2.5 border border-[#e9e9e7] rounded-lg bg-[#fbfbfa] text-sm focus:outline-none focus:bg-white focus:border-[#01696f] text-[#1a202c] shadow-inner placeholder:text-gray-400 font-medium"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-[#01696f] hover:bg-[#005459] text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1 shadow-xs active:scale-[0.98]"
                    >
                      {loading ? 'Searching...' : 'Find Records'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Patient Dashboard */
          <div className="space-y-8 animate-in fade-in duration-300">

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-md border border-red-200 font-medium flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" /> {error}
                <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 cursor-pointer">Dismiss</button>
              </div>
            )}

            {/* Patient Header Card */}
            <div className="bg-white border border-[#e9e9e7] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 bg-[#e6f3f4] text-[#01696f] rounded-full flex items-center justify-center font-bold text-xl shadow-xs">
                  {patient.name ? patient.name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-[#1a202c]">{patient.name}</h2>
                  <div className="flex items-center gap-3 text-xs text-[#64748b] mt-1 font-medium">
                    <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span>
                    <span>·</span>
                    <span>{patient.age ? `${patient.age} yrs` : 'Age N/A'}</span>
                    {patient.gender && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{patient.gender}</span>
                      </>
                    )}
                    {patient.bloodGroup && (
                      <>
                        <span>·</span>
                        <span className="uppercase text-[#01696f] font-semibold">{patient.bloodGroup}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setPatient(null);
                  setPhone('');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e9e9e7] bg-white rounded-lg text-xs font-semibold text-[#64748b] hover:text-[#1a202c] hover:bg-[#f4f4f3] transition-colors cursor-pointer shadow-xs"
              >
                <LogOut className="h-3.5 w-3.5" /> Switch Account
              </button>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Appointments */}
              <div className="space-y-6">
                <div className="bg-white border border-[#e9e9e7] rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold uppercase text-[#01696f] tracking-wider flex items-center gap-2 border-b border-[#e9e9e7] pb-3">
                    <Calendar className="h-4 w-4" /> Appointments ({appointments.length})
                  </h3>
                  
                  {appointments.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#64748b] font-medium">
                      No upcoming appointments scheduled.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {appointments.map((appt: any) => (
                        <div key={appt.id} className="p-4 bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl space-y-2.5 hover:border-[#01696f]/40 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-semibold text-[#1a202c]">Dr. {appt.doctor?.user?.name}</p>
                              <p className="text-[10px] text-[#64748b] font-medium mt-0.5 uppercase tracking-wider">{appt.doctor?.speciality}</p>
                            </div>
                            <span className="text-[8px] bg-[#e6f3f4] text-[#01696f] border border-[#01696f]/20 px-2 py-0.5 rounded font-bold uppercase">
                              {appt.type}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-[#64748b] pt-1.5 border-t border-[#e9e9e7] border-dashed">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-[#01696f]" /> {appt.date}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" /> {appt.timeSlot}</span>
                            </div>
                            {appt.status === 'BOOKED' && (
                              <button
                                onClick={() => handleCancelAppointment(appt.id, appt.date)}
                                className="flex items-center gap-1 text-[9px] font-bold text-red-500 border border-red-200 bg-white hover:bg-red-50 px-2 py-1 rounded-md transition-colors cursor-pointer"
                              >
                                <X className="h-3 w-3" /> Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Visit History */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-[#e9e9e7] rounded-2xl p-6 shadow-sm space-y-5">
                  <h3 className="text-xs font-bold uppercase text-[#01696f] tracking-wider flex items-center gap-2 border-b border-[#e9e9e7] pb-3">
                    <FileText className="h-4 w-4" /> Medical Visit History ({visitLogs.length})
                  </h3>

                  {visitLogs.length === 0 ? (
                    <div className="py-16 text-center text-sm text-[#64748b] font-medium">
                      <FileText className="h-10 w-10 text-[#e9e9e7] mx-auto mb-2" />
                      No visit records found.
                    </div>
                  ) : (
                    <div className="space-y-5 max-h-[600px] overflow-y-auto pr-1">
                      {visitLogs.map((log: any, idx: number) => (
                        <div key={log.id} className="p-5 bg-white border border-[#e9e9e7] rounded-xl space-y-4 shadow-xs relative hover:border-[#01696f]/20 transition-all duration-200">
                          
                          {/* Visit header card */}
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-[#1a202c]">Dr. {log.doctorName}</h4>
                                <span className="text-[10px] bg-[#f4f4f3] text-[#64748b] px-2 py-0.5 rounded font-medium">{log.specialty}</span>
                              </div>
                              <p className="text-[10px] text-[#64748b] font-semibold mt-1">
                                {new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                <span className="mx-1.5">·</span>
                                Token: <span className="font-mono text-[#01696f] font-bold">{log.tokenNo}</span>
                              </p>
                            </div>
                            
                            <button
                              onClick={() => handlePrintPrescription(log)}
                              className="flex items-center gap-1 text-[10px] font-bold text-[#01696f] border border-[#01696f]/30 bg-white hover:bg-[#e6f3f4] px-2.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer"
                              aria-label="Download or print prescription"
                            >
                              <Printer className="h-3.5 w-3.5" /> Slip
                            </button>
                          </div>

                          {/* Chief Complaint */}
                          {log.chiefComplaint && (
                            <div className="text-xs">
                              <span className="font-semibold text-[#64748b] uppercase tracking-wider text-[9px] block mb-0.5">Reason for Visit</span>
                              <p className="text-[#1a202c] font-medium">{log.chiefComplaint}</p>
                            </div>
                          )}

                          {/* Notes/Prescription */}
                          {log.notes && (
                            <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg p-4 font-light text-xs text-[#1a202c] leading-relaxed relative">
                              <span className="font-bold text-[#01696f] uppercase tracking-wider text-[9px] block mb-2">Rx & Clinical Notes</span>
                              <p className="whitespace-pre-wrap italic font-serif text-[13px]">{log.notes}</p>
                            </div>
                          )}

                          {/* Bottom info: rating & follow-up */}
                          <div className="flex items-center justify-between text-xs pt-3 border-t border-[#e9e9e7] border-dashed">
                            {log.followUpDate ? (
                              <span className="flex items-center gap-1 text-[#01696f] font-semibold">
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                Follow-up: {log.followUpDate}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-[10px]">No follow-up scheduled</span>
                            )}
                            {log.rating && (
                              <div className="flex items-center gap-0.5">
                                <span className="text-[10px] text-[#64748b] font-medium mr-1">Your rating:</span>
                                <span className="text-amber-400 flex">
                                  {'★'.repeat(log.rating)}{'☆'.repeat(5 - log.rating)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
