'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { apiRequest } from '../../../src/utils/api';
import { useClerkSync } from '../../../src/utils/useClerkSync';
import { useToast } from '../../../src/components/Toast';
import UserGuide from '../../../src/components/UserGuide';
import {
  Receipt, Plus, CreditCard, CheckCircle2, X, Printer, Trash,
  Activity, ArrowLeft, Loader2, User, Phone, Stethoscope, FileText, Search,
  LayoutDashboard, Users, Settings, Calendar, LogOut, MessageCircle
} from 'lucide-react';

interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paymentMethod?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
}

const DEFAULT_ITEMS: InvoiceItem[] = [{ description: 'Consultation Fee', qty: 1, unitPrice: 500, total: 500 }];

export default function BillingDashboard() {
  const { syncing, isSignedIn } = useClerkSync();
  const { user } = useUser();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();

  const [branchId, setBranchId] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Create invoice modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({ patientName: '', patientPhone: '', doctorName: '', notes: '' });
  const [items, setItems] = useState<InvoiceItem[]>(DEFAULT_ITEMS);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  // Pay modal
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'INSURANCE'>('CASH');
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (!syncing && !isSignedIn) router.replace('/login');
  }, [syncing, isSignedIn, router]);

  useEffect(() => {
    const cId = localStorage.getItem('cureq_clinic_id') || '';
    const bId = localStorage.getItem('cureq_branch_id') || '';
    setClinicId(cId);
    setBranchId(bId);
  }, []);

  useEffect(() => {
    if (branchId) fetchInvoices();
  }, [branchId, selectedDate, filterStatus]);

  const fetchInvoices = async () => {
    if (!branchId) return;
    setIsLoading(true);
    try {
      const data = await apiRequest(`/billing/${branchId}?date=${selectedDate}&status=${filterStatus}`);
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load invoices.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const total = Math.max(0, subtotal - discount + tax);

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'qty' || field === 'unitPrice') {
        updated.total = Number(updated.qty) * Number(updated.unitPrice);
      }
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, { description: '', qty: 1, unitPrice: 0, total: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleCreate = async () => {
    if (!form.patientName || !form.patientPhone || !form.doctorName) {
      showToast('Patient name, phone and doctor name are required.', 'error'); return;
    }
    if (items.some(i => !i.description)) {
      showToast('All line items must have a description.', 'error'); return;
    }
    setIsCreating(true);
    try {
      await apiRequest(`/billing/${branchId}`, {
        method: 'POST',
        body: JSON.stringify({ ...form, clinicId, items, discount, tax }),
      });
      showToast('Invoice created successfully.', 'success');
      setIsCreateOpen(false);
      setForm({ patientName: '', patientPhone: '', doctorName: '', notes: '' });
      setItems(DEFAULT_ITEMS);
      setDiscount(0); setTax(0);
      fetchInvoices();
    } catch {
      showToast('Failed to create invoice.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePay = async () => {
    if (!payInvoice) return;
    setIsPaying(true);
    try {
      await apiRequest(`/billing/invoice/${payInvoice.id}/pay`, { method: 'PUT', body: JSON.stringify({ paymentMethod }) });
      showToast('Invoice marked as paid.', 'success');
      setPayInvoice(null);
      fetchInvoices();
    } catch {
      showToast('Failed to mark as paid.', 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return;
    try {
      await apiRequest(`/billing/invoice/${id}/cancel`, { method: 'PUT' });
      showToast('Invoice cancelled.', 'success');
      fetchInvoices();
    } catch {
      showToast('Failed to cancel invoice.', 'error');
    }
  };

  const handlePrint = (inv: Invoice) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = (inv.items as InvoiceItem[]).map((item, i) => `
      <tr style="border-bottom:1px solid #f0f0f0;${i % 2 ? 'background:#f9fafb' : ''}">
        <td style="padding:10px 14px">${item.description}</td>
        <td style="padding:10px 14px;text-align:center">${item.qty}</td>
        <td style="padding:10px 14px;text-align:right">₹${item.unitPrice.toFixed(2)}</td>
        <td style="padding:10px 14px;text-align:right;font-weight:600">₹${item.total.toFixed(2)}</td>
      </tr>`).join('');

    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoiceNo}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:30px auto;color:#1a202c;font-size:14px}
        table{width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
        th{background:#01696f;color:#fff;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
        .badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700}
        .badge-paid{background:#dcfce7;color:#166534}
        .badge-pending{background:#fef9c3;color:#854d0e}
        @media print{button{display:none}}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;border-bottom:3px solid #01696f;padding-bottom:14px;margin-bottom:20px">
        <div><h2 style="margin:0;font-size:22px">CureQ Clinic</h2><p style="margin:4px 0 0;color:#64748b;font-size:13px">Tax Invoice</p></div>
        <div style="text-align:right;font-size:13px">
          <p style="margin:0;font-size:16px;font-weight:700;color:#01696f">${inv.invoiceNo}</p>
          <p style="margin:4px 0 0;color:#64748b">Date: ${new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          <span class="badge ${inv.status === 'PAID' ? 'badge-paid' : 'badge-pending'}">${inv.status}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;font-size:13px">
        <div><p style="margin:0;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Bill To</p>
          <p style="margin:0;font-weight:600">${inv.patientName}</p>
          <p style="margin:2px 0 0;color:#64748b">${inv.patientPhone}</p>
        </div>
        <div><p style="margin:0;font-weight:700;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Consulting Doctor</p>
          <p style="margin:0;font-weight:600">${inv.doctorName}</p>
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;text-align:right;font-size:13px">
        <p style="margin:4px 0">Subtotal: <strong>₹${inv.subtotal.toFixed(2)}</strong></p>
        ${inv.discount > 0 ? `<p style="margin:4px 0;color:#16a34a">Discount: -₹${inv.discount.toFixed(2)}</p>` : ''}
        ${inv.tax > 0 ? `<p style="margin:4px 0">Tax: +₹${inv.tax.toFixed(2)}</p>` : ''}
        <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#01696f">Total: ₹${inv.total.toFixed(2)}</p>
        ${inv.paymentMethod ? `<p style="margin:4px 0;color:#64748b;font-size:12px">Payment: ${inv.paymentMethod}</p>` : ''}
      </div>
      ${inv.notes ? `<p style="margin-top:18px;font-size:12px;color:#64748b">Notes: ${inv.notes}</p>` : ''}
      <script>window.onload=()=>{window.print()}</script></body></html>`);
    w.document.close();
  };

  const filtered = invoices.filter(inv =>
    inv.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.patientPhone.includes(searchQuery)
  );

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'PAID').length,
    revenue: invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0),
    pending: invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total, 0),
  };

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#1a202c] font-sans flex flex-col md:flex-row selection:bg-[#01696f]/20">
      {ToastComponent}
      <UserGuide />

      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-[#e9e9e7] flex flex-col h-auto md:h-screen sticky top-0 z-20 shadow-xs shrink-0">
        <div className="p-6 border-b border-[#e9e9e7] flex items-center gap-2">
          <Activity className="h-6 w-6 text-[#01696f]" />
          <span className="font-serif text-xl font-bold tracking-tight text-[#1a202c]">CureQ</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link href="/dashboard/reception?tab=Dashboard" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link href="/dashboard/reception?tab=Patients" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Users className="h-4 w-4" /> Patient Records
          </Link>
          <Link href="/dashboard/reception?tab=Settings" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Settings className="h-4 w-4" /> Clinic Settings
          </Link>
          <Link href="/dashboard/reception?tab=All%20Queues" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Activity className="h-4 w-4" /> All Queues
          </Link>
          <Link href="/dashboard/reception?tab=Waitlist" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
            <Calendar className="h-4 w-4" /> Waitlist
          </Link>
          <div className="pt-2 border-t border-[#e9e9e7] mt-2">
            <div className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm bg-[#f4f4f3] text-[#01696f]">
              <Receipt className="h-4 w-4" /> Billing
            </div>
            <Link href="/dashboard/chatbot" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#01696f] transition-colors">
              <MessageCircle className="h-4 w-4" /> AI Chatbot
            </Link>
            <Link href="/dashboard/analytics" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#01696f] transition-colors">
              <Activity className="h-4 w-4" /> Analytics
            </Link>
            <Link href="/dashboard/doctor" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
              <Users className="h-4 w-4" /> Doctor Console
            </Link>
            <Link href="/patient/portal" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
              <Search className="h-4 w-4" /> Patient Portal
            </Link>
            {clinicId && (
              <a href={`/waitlist/${clinicId}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm text-[#64748b] hover:bg-[#fbfbfa] hover:text-[#1a202c] transition-colors">
                <Calendar className="h-4 w-4" /> Pre-Register (Public)
              </a>
            )}
          </div>
        </nav>
        <div className="p-4 border-t border-[#e9e9e7]">
          <button
            onClick={() => {
              if (confirm('Sign out and clear session?')) {
                localStorage.removeItem('cureq_token');
                localStorage.removeItem('cureq_role');
                localStorage.removeItem('cureq_clinic_id');
                localStorage.removeItem('cureq_branch_id');
                localStorage.removeItem('cureq_active_doctor_id');
                window.location.href = '/login';
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-xs text-red-600 hover:bg-red-50 transition-colors cursor-pointer mb-3"
            aria-label="Sign Out"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Avatar" className="h-10 w-10 rounded-full object-cover border border-[#e9e9e7]" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-[#e6f3f4] text-[#01696f] flex items-center justify-center font-bold">
                {user?.fullName ? user.fullName.charAt(0) : 'R'}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold truncate max-w-[140px]" title={user?.fullName || 'Receptionist'}>
                {user?.fullName || 'Receptionist'}
              </p>
              <p className="text-xs text-[#64748b]">Front Desk</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <header className="bg-white border-b border-[#e9e9e7] px-6 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-xs">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-[#f4f4f3] text-[#64748b] transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#01696f]" />
          <span className="font-serif text-lg font-bold tracking-tight">CureQ</span>
          <span className="text-[#e9e9e7] mx-1">/</span>
          <span className="font-semibold text-[#64748b] text-sm">Billing</span>
        </div>
        <div className="flex-1" />
        <button onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#01696f] text-white rounded-lg text-sm font-semibold hover:bg-[#015a5f] transition-colors">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Invoices', value: stats.total, color: 'text-[#1a202c]' },
            { label: 'Paid', value: stats.paid, color: 'text-green-700' },
            { label: 'Revenue Today', value: `₹${stats.revenue.toFixed(0)}`, color: 'text-[#01696f]' },
            { label: 'Pending Amount', value: `₹${stats.pending.toFixed(0)}`, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs">
              <p className="text-xs text-[#64748b] font-semibold uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#e9e9e7] rounded-xl p-4 shadow-xs flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search patient, invoice no..."
              className="w-full pl-9 pr-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
          </div>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
          <div className="flex gap-1.5">
            {(['ALL', 'PENDING', 'PAID', 'CANCELLED'] as const).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-[#01696f] text-white' : 'bg-[#f4f4f3] text-[#64748b] hover:bg-[#e9e9e7]'}`}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={fetchInvoices} className="px-3 py-1.5 text-xs font-semibold text-[#01696f] hover:underline">Refresh</button>
        </div>

        {/* Invoice List */}
        <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-[#01696f] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-[#64748b]">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No invoices found</p>
              <p className="text-xs mt-1">Create your first invoice using the button above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[#fbfbfa] border-b border-[#e9e9e7]">
                <tr>
                  {['Invoice No', 'Patient', 'Doctor', 'Total', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#64748b]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f3]">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-[#fbfbfa] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#01696f]">{inv.invoiceNo}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[13px]">{inv.patientName}</p>
                      <p className="text-[11px] text-[#64748b]">{inv.patientPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#64748b]">{inv.doctorName}</td>
                    <td className="px-4 py-3 font-bold text-[#01696f]">₹{inv.total.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        inv.status === 'PAID' ? 'bg-green-50 text-green-700' :
                        inv.status === 'CANCELLED' ? 'bg-red-50 text-red-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handlePrint(inv)} title="Print" className="p-1.5 rounded hover:bg-[#f4f4f3] text-[#64748b] transition-colors">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        {inv.status === 'PENDING' && (
                          <>
                            <button onClick={() => { setPayInvoice(inv); setPaymentMethod('CASH'); }} title="Mark Paid"
                              className="flex items-center gap-1 px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 text-[11px] font-semibold transition-colors">
                              <CreditCard className="h-3 w-3" /> Pay
                            </button>
                            <button onClick={() => handleCancel(inv.id)} title="Cancel"
                              className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {inv.status === 'PAID' && (
                          <span className="flex items-center gap-1 text-[11px] text-green-700 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> {inv.paymentMethod}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Create Invoice Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[#e9e9e7]">
            <div className="flex items-center justify-between p-6 border-b border-[#e9e9e7] sticky top-0 bg-white z-10">
              <h2 className="font-bold text-lg flex items-center gap-2"><Receipt className="h-5 w-5 text-[#01696f]" /> New Invoice</h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-1.5 rounded hover:bg-[#f4f4f3] text-[#64748b]"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Patient Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
                    <input value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} placeholder="Full name"
                      className="w-full pl-9 pr-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
                    <input value={form.patientPhone} onChange={e => setForm(f => ({ ...f, patientPhone: e.target.value }))} placeholder="Phone number"
                      className="w-full pl-9 pr-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Doctor Name *</label>
                <div className="relative">
                  <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9ca3af]" />
                  <input value={form.doctorName} onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))} placeholder="Dr. Name"
                    className="w-full pl-9 pr-3 py-2.5 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Line Items</label>
                  <button onClick={addItem} className="flex items-center gap-1 text-[11px] text-[#01696f] hover:underline font-semibold">
                    <Plus className="h-3 w-3" /> Add Item
                  </button>
                </div>
                <div className="border border-[#e9e9e7] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#fbfbfa]">
                      <tr>
                        {['Description', 'Qty', 'Unit Price (₹)', 'Total', ''].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f3]">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1.5">
                            <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="e.g. Consultation"
                              className="w-full px-2 py-1 border border-[#e9e9e7] rounded text-sm focus:outline-none focus:border-[#01696f]" />
                          </td>
                          <td className="px-2 py-1.5 w-16">
                            <input type="number" min={1} value={item.qty} onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                              className="w-full px-2 py-1 border border-[#e9e9e7] rounded text-sm focus:outline-none focus:border-[#01696f] text-center" />
                          </td>
                          <td className="px-2 py-1.5 w-28">
                            <input type="number" min={0} value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                              className="w-full px-2 py-1 border border-[#e9e9e7] rounded text-sm focus:outline-none focus:border-[#01696f]" />
                          </td>
                          <td className="px-2 py-1.5 w-24 font-semibold text-[#01696f]">₹{item.total.toFixed(2)}</td>
                          <td className="px-2 py-1.5 w-8">
                            {items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50 text-red-400">
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Discount (₹)</label>
                  <input type="number" min={0} value={discount} onChange={e => setDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Tax (₹)</label>
                  <input type="number" min={0} value={tax} onChange={e => setTax(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f]" />
                </div>
                <div className="flex items-end">
                  <div className="w-full bg-[#e6f3f4] rounded-lg p-3">
                    <p className="text-[10px] text-[#64748b] font-semibold uppercase tracking-wider">Total</p>
                    <p className="text-xl font-bold text-[#01696f]">₹{total.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes..."
                  className="w-full px-3 py-2 border border-[#e9e9e7] rounded-lg text-sm focus:outline-none focus:border-[#01696f] resize-none" />
              </div>
            </div>

            <div className="flex gap-3 justify-end p-6 border-t border-[#e9e9e7]">
              <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-lg border border-[#e9e9e7] text-sm font-semibold text-[#64748b] hover:bg-[#f4f4f3] transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={isCreating}
                className="flex items-center gap-2 px-5 py-2 bg-[#01696f] text-white rounded-lg text-sm font-semibold hover:bg-[#015a5f] disabled:opacity-60 transition-colors">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isCreating ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {payInvoice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-[#e9e9e7] p-6">
            <h3 className="font-bold text-lg mb-1">Collect Payment</h3>
            <p className="text-sm text-[#64748b] mb-4">{payInvoice.patientName} · <strong className="text-[#01696f]">₹{payInvoice.total.toFixed(2)}</strong></p>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {(['CASH', 'CARD', 'UPI', 'INSURANCE'] as const).map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${paymentMethod === m ? 'bg-[#01696f] text-white border-[#01696f]' : 'bg-white text-[#64748b] border-[#e9e9e7] hover:border-[#01696f]'}`}>
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPayInvoice(null)} className="flex-1 py-2 rounded-lg border border-[#e9e9e7] text-sm font-semibold text-[#64748b] hover:bg-[#f4f4f3]">Cancel</button>
              <button onClick={handlePay} disabled={isPaying}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors">
                {isPaying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isPaying ? 'Processing…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
