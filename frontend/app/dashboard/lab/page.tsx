'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, BACKEND_URL } from '../../../src/utils/api';
import io from 'socket.io-client';
import { TestTube, CheckCircle2, Clock, AlertTriangle, RefreshCw, Search, Phone, FileText, FlaskConical } from 'lucide-react';

export default function LabDashboard() {
  const router = useRouter();
  const [branchId, setBranchId] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const savedBranchId = localStorage.getItem('cureq_branch_id') || '';
    setBranchId(savedBranchId);
    if (savedBranchId) {
      fetchOrders(savedBranchId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchOrders = async (bId: string) => {
    try {
      const res = await apiRequest(`/prescriptions/orders/lab/${bId}?status=${statusFilter}`);
      setOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to fetch lab orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!branchId) return;

    fetchOrders(branchId);

    const socket = io(BACKEND_URL);
    socket.on('connect', () => {
      socket.emit('join:branch', branchId);
    });

    socket.on('lab:new-order', () => {
      fetchOrders(branchId);
    });

    socket.on('lab:order-updated', () => {
      fetchOrders(branchId);
    });

    return () => {
      socket.disconnect();
    };
  }, [branchId, statusFilter]);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await apiRequest(`/prescriptions/orders/lab/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchOrders(branchId);
    } catch (err: any) {
      alert(err.message || 'Failed to update lab order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const query = searchQuery.toLowerCase();
    return (
      o.patientName?.toLowerCase().includes(query) ||
      o.patientPhone?.includes(query) ||
      o.tokenNo?.toLowerCase().includes(query)
    );
  });

  const urgentCount = orders.filter((o) => o.priority === 'URGENT' && o.status !== 'COMPLETED').length;
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const collectedCount = orders.filter((o) => o.status === 'SAMPLE_COLLECTED').length;
  const readyCount = orders.filter((o) => o.status === 'REPORT_READY').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Top Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600 rounded-xl text-white">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Diagnostic Lab Hub</h1>
            <p className="text-xs text-slate-400">Sample Collection & Test Report Fulfillment Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchOrders(branchId)}
            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <a
            href="/dashboard/reception"
            className="px-3 py-1.5 bg-[#01696f] hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Reception Console
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Stat / Urgent Orders</span>
            <p className="text-2xl font-extrabold text-white mt-1 flex items-center gap-2">
              {urgentCount}
              {urgentCount > 0 && <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>}
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending Samples</span>
            <p className="text-2xl font-extrabold text-white mt-1">{pendingCount}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Samples Collected</span>
            <p className="text-2xl font-extrabold text-white mt-1">{collectedCount}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Reports Ready</span>
            <p className="text-2xl font-extrabold text-white mt-1">{readyCount}</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'PENDING', 'SAMPLE_COLLECTED', 'PROCESSING', 'REPORT_READY', 'COMPLETED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search patient or test..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Lab Orders List */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs animate-pulse">
            Loading diagnostic lab orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 text-center bg-slate-800 rounded-xl border border-slate-700">
            <FlaskConical className="h-10 w-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-300">No lab orders found</p>
            <p className="text-xs text-slate-500 mt-1">Diagnostic lab tests requested by doctors will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const tests = (order.tests as any[]) || [];
              const isUrgent = order.priority === 'URGENT';

              return (
                <div
                  key={order.id}
                  className={`bg-slate-800 border rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg transition-all ${
                    isUrgent ? 'border-red-600/80 bg-slate-800/90' : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-700 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-white">{order.patientName}</span>
                          {order.tokenNo && (
                            <span className="bg-purple-900/60 text-purple-300 text-xs px-2 py-0.5 rounded font-mono font-bold border border-purple-700">
                              {order.tokenNo}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" /> {order.patientPhone}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isUrgent && (
                          <span className="bg-red-950 text-red-400 border border-red-700 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                            🔥 STAT / URGENT
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            order.status === 'PENDING'
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800'
                              : order.status === 'SAMPLE_COLLECTED'
                              ? 'bg-purple-950/60 text-purple-400 border border-purple-800'
                              : order.status === 'REPORT_READY'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* Tests Required */}
                    <div className="mt-4 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Required Lab Tests ({tests.length}):</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {tests.map((t: any, idx: number) => (
                          <div key={idx} className="bg-slate-900/70 p-2.5 rounded text-xs border border-slate-750 flex items-center justify-between">
                            <span className="font-bold text-purple-200">{t.testName}</span>
                            <TestTube className="h-3.5 w-3.5 text-purple-400" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Doctor Info */}
                    {order.prescription?.doctorName && (
                      <p className="mt-3 text-[11px] text-slate-400">
                        Ordered by: <strong className="text-slate-200">Dr. {order.prescription.doctorName}</strong>
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-700 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    <div className="flex gap-2">
                      {order.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'SAMPLE_COLLECTED')}
                          disabled={updatingId === order.id}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Collect Sample
                        </button>
                      )}
                      {order.status === 'SAMPLE_COLLECTED' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'REPORT_READY')}
                          disabled={updatingId === order.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          Mark Report Ready & Alert
                        </button>
                      )}
                      {order.status === 'REPORT_READY' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                          disabled={updatingId === order.id}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-emerald-400 text-xs font-bold rounded-lg transition-colors border border-emerald-600"
                        >
                          Handed Over
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
