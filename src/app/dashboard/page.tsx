"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  ResponsiveContainer, 
  Tooltip, 
  LineChart,
  Line,
  XAxis, 
  YAxis,
  CartesianGrid
} from "recharts";
import { subDays, startOfDay, format } from "date-fns";
import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";

// Exact colors from the Stitch design and image
const GlassCard = ({ children, className = "", delay = 0, style = {} }: { children: React.ReactNode, className?: string, delay?: number, style?: React.CSSProperties }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    className={`bg-[var(--surface)] border border-[color:var(--soft-border)] shadow-[0_8px_20px_rgba(30,41,59,0.08)] rounded-[24px] p-6 ${className}`}
    style={style}
  >
    <div className="relative z-10 w-full h-full flex flex-col text-[var(--text)]">
       {children}
    </div>
  </motion.div>
);

interface MetricPayload {
  pendingApprovals: number;
  pendingList: any[];
  activeDoctors: number;
  totalScans: number;
  agreementRate: number;
  weeklyData: any[];
  recentScreenings: any[];
}

const RECENT_SCREENINGS_LIMIT = 10;

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricPayload>({
    pendingApprovals: 0,
    pendingList: [],
    activeDoctors: 0,
    totalScans: 0,
    agreementRate: 0,
    weeklyData: [],
    recentScreenings: []
  });

  useEffect(() => {
    async function loadMetrics() {
      try {
        const pendingQuery = query(collection(db, "users"), where("verificationStatus", "==", "pending"));
        const pendingSnap = await getDocs(pendingQuery);
        const pendingArr: any[] = [];
        pendingSnap.forEach(doc => pendingArr.push({ id: doc.id, ...doc.data() }));

        const activeDocQuery = query(collection(db, "users"), where("role", "==", "doctor"), where("verificationStatus", "==", "approved"));
        const activeDocSnap = await getCountFromServer(activeDocQuery);

        const screeningsSnap = await getDocs(collection(db, "screenings"));
        
        let total = 0;
        let agreedCount = 0;
        let finalDiagnosisCount = 0;
        
        const now = new Date();
        const weeklyArray = Array.from({ length: 7 }, (_, i) => {
          const d = subDays(now, 6 - i);
          return { date: format(d, 'MMM dd'), ts: startOfDay(d).getTime(), scans: 0 }
        });

        const rawScreeningsData: any[] = [];

        screeningsSnap.forEach(doc => {
          total++;
          const data = doc.data();

          let parsedDate = new Date();
          if (data.createdAt) { parsedDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt); }
          else if (data.timestamp) { parsedDate = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp); }

          const pName = data.patientName || data.patientDisplayName || (data.patientId ? data.patientId.substring(0, 8) + '...' : 'Unknown Patient');

          rawScreeningsData.push({ id: doc.id, ...data, dateObj: parsedDate, displayNameFallback: pName });

          if (data.finalDiagnosis) {
            finalDiagnosisCount++;
            if (data.aiDiagnosis && data.aiDiagnosis.trim().toLowerCase() === data.finalDiagnosis.trim().toLowerCase()) {
              agreedCount++;
            }
          }

          const docTs = startOfDay(parsedDate).getTime();
          const targetDay = weeklyArray.find(day => day.ts === docTs);
          if (targetDay) { targetDay.scans++; }
        });

        const agreementRate = finalDiagnosisCount > 0 ? Math.round((agreedCount / finalDiagnosisCount) * 100) : 0;

        const sorted = rawScreeningsData.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
        const recentScreenings = sorted.slice(0, RECENT_SCREENINGS_LIMIT);

        setMetrics({
          pendingApprovals: pendingArr.length,
          pendingList: pendingArr,
          activeDoctors: activeDocSnap.data().count,
          totalScans: total,
          agreementRate,
          weeklyData: weeklyArray,
          recentScreenings
        });

      } catch (error) {
        console.error("Failed to load metrics:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, []);

  return (
    <div className={`min-h-screen p-6 md:p-8 pb-16 font-sans relative transition-colors duration-500 overflow-y-auto bg-[var(--background)] text-[var(--text)]`}>

      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          <div className="animate-pulse bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-3xl h-[280px]"></div>
          <div className="animate-pulse bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-3xl h-[400px] md:col-span-2"></div>
          <div className="animate-pulse bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-3xl h-[400px]"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* Top Row: Command Center */}
          <div className="w-full h-auto">
            
            {/* HERO SECTION */}
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="w-full relative overflow-hidden bg-[var(--surface)] rounded-[24px] border border-[color:var(--soft-border)] shadow-[0_12px_28px_rgba(30,41,59,0.08)] p-6 md:p-8 flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)]/30 blur-[80px] rounded-full pointer-events-none -mt-20 -mr-20"></div>
              
              <div className="relative z-10">
                <h2 className="text-[28px] font-bold text-[var(--text)] tracking-tight">OptiTrace AI Command Center</h2>
                <p className="text-[var(--muted-text)] mt-1 text-[15px]">Welcome back, Admin.</p>
              </div>

              <div className="mt-8 mb-6 z-10 relative">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-sm font-medium text-[var(--muted-text)]">AI Accuracy Target</span>
                  <span className="text-3xl font-bold text-[var(--primary)] leading-none">{metrics.agreementRate}%</span>
                </div>
                <div className="w-full bg-[var(--background)] rounded-full h-3.5 shadow-inner overflow-hidden border border-[color:var(--soft-border)]">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${metrics.agreementRate}%` }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                    className="bg-gradient-to-r from-[var(--primary)] to-[#87b0d2] h-full rounded-full transition-all ease-out relative"
                  >
                    <div className="absolute inset-0 bg-[var(--background)]/40 w-full animate-pulse"></div>
                  </motion.div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 z-10 relative mt-auto border-t border-[color:var(--soft-border)] pt-5">
                <div className="border-r border-[color:var(--soft-border)] pr-4">
                  <p className="text-[11px] text-[var(--muted-text)] font-bold tracking-widest uppercase mb-1">Total Scans</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{metrics.totalScans}</p>
                </div>
                <div className="border-r-0 md:border-r border-[color:var(--soft-border)] pr-4 md:pl-4">
                  <p className="text-[11px] text-[var(--muted-text)] font-bold tracking-widest uppercase mb-1">Active Doctors</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{metrics.activeDoctors}</p>
                </div>
                <div className="border-r border-[color:var(--soft-border)] pr-4 md:pl-4">
                  <p className="text-[11px] text-[var(--muted-text)] font-bold tracking-widest uppercase mb-1">Pending Queue</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{metrics.pendingApprovals}</p>
                </div>
                <div className="md:pl-4">
                  <p className="text-[11px] text-[var(--muted-text)] font-bold tracking-widest uppercase mb-1">Match Rate</p>
                  <p className="text-2xl font-bold text-[var(--text)]">{metrics.agreementRate}%</p>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Bottom Row */}
          <div className="flex flex-col xl:flex-row gap-6">

            {/* RECENT SCREENINGS */}
            <GlassCard delay={0.3} className="flex-[1.8] flex flex-col min-h-[380px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[15px] font-semibold text-[var(--text)] tracking-wide">Recent Screenings</h3>
                <Link href="/dashboard/analytics" className="text-[11px] font-semibold text-[var(--primary)] hover:opacity-85 transition-colors uppercase tracking-widest px-3 py-1.5 opacity-80 hover:opacity-100">View All →</Link>
              </div>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="text-[10px] text-[var(--muted-text)] uppercase tracking-widest bg-[var(--background)] border-b border-[color:var(--soft-border)]">
                      <th className="py-3 px-4 font-bold rounded-tl-lg">Name</th>
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">AI Diagnosis</th>
                      <th className="py-3 px-4 font-bold rounded-tr-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--soft-border)]">
                    {metrics.recentScreenings.length === 0 ? (
                      <tr><td colSpan={4} className="py-8 text-center text-[var(--muted-text)]">No screenings recorded yet.</td></tr>
                    ) : (
                      metrics.recentScreenings.map(s => (
                        <tr key={s.id} className="hover:bg-[var(--row-hover)] transition-colors">
                          <td className="py-3.5 px-4 font-medium text-[var(--text)]">{s.displayNameFallback}</td>
                          <td className="py-3.5 px-4 text-[var(--muted-text)] text-[13px]">{format(s.dateObj, 'MMM dd, yyyy HH:mm')}</td>
                          <td className="py-3.5 px-4 text-[var(--text)]/85 text-[13px]">{s.aiDiagnosis || 'N/A'}</td>
                          <td className="py-3.5 px-4">
                            {s.finalDiagnosis ? (
                              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold rounded-full tracking-widest">Finalized</span>
                            ) : (
                              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] uppercase font-bold rounded-full tracking-widest">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <div className="flex-[1] flex flex-col gap-6">
              
              {/* ACTION REQUIRED */}
              <GlassCard delay={0.4} className="flex-1 flex flex-col relative min-h-[140px]">
                <h3 className="text-[15px] font-semibold text-[var(--text)] tracking-wide mb-4">Action Required</h3>
                <div className="flex-1 overflow-y-auto">
                  {metrics.pendingApprovals === 0 ? (
                    <div className="flex flex-col items-center justify-center opacity-70 mt-2">
                       <ClipboardList size={32} className="text-[var(--text)] mb-2" />
                       <span className="text-sm text-[var(--text)] tracking-wide">All caught up!</span>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2">
                      {metrics.pendingList.slice(0, 3).map(doc => (
                        <div key={doc.id} className="flex justify-between items-center group p-3 bg-[var(--background)] hover:bg-[var(--row-hover)] rounded-xl transition-all blur-0 pointer-events-auto border border-[color:var(--soft-border)]">
                          <div className="truncate pr-3">
                            <p className="text-[13px] text-[var(--text)] font-medium truncate">{doc.displayName || 'Unknown Physician'}</p>
                          </div>
                          <Link href="/dashboard/approvals" className="shrink-0 text-[var(--primary)] text-[10px] uppercase font-bold tracking-widest">Review</Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* SCAN VOLUME LINECHART */}
              <GlassCard delay={0.5} className="flex-[1.5] flex flex-col min-h-[216px]">
                <h3 className="text-[15px] font-semibold text-[var(--text)] tracking-wide mb-4">Scan Volume (Last 7 Days)</h3>
                <div className="w-full h-[300px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.weeklyData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.2)" />
                      <XAxis dataKey="date" stroke="var(--text)" tick={{ fill: 'var(--text)', fontSize: 10 }} axisLine={false} tickLine={false} dy={8} />
                      <YAxis stroke="var(--text)" tick={{ fill: 'var(--text)', fontSize: 10 }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(30,41,59,0.06)' }}
                        contentStyle={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--soft-border-strong)',
                          color: 'var(--text)',
                          borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                          backdropFilter: 'blur(8px)'
                        }}
                        itemStyle={{ color: 'var(--text)' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="scans"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        dot={{ r: 3, fill: 'var(--primary)', stroke: 'var(--text)', strokeWidth: 1.5 }}
                        activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--text)', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
