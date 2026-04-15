"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";
import { Download } from "lucide-react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";

const PIE_COLORS = ['#9ABDDC', '#7EA9CF', '#5F87AD', '#4F6F8D', '#A8C7E1', '#89B2D6', '#6D97BC'];
const SEASONAL_BAR_COLORS = ['#5F87AD', '#7EA9CF', '#9ABDDC', '#6D97BC', '#4F6F8D', '#89B2D6', '#A8C7E1'];
const ACCURACY_BAR_COLORS = ['#7EA9CF', '#9ABDDC', '#5F87AD', '#A8C7E1', '#6D97BC', '#89B2D6', '#4F6F8D'];

interface RawScreening {
  id: string;
  patientId?: string;
  aiDiagnosis?: string;
  finalDiagnosis?: string;
  createdAt: any; 
  timestamp: any;
  dateObj?: Date;
}

type RangePreset = "today" | "7d" | "30d" | "quarterly" | "yearly" | "all" | "custom";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [rawScreenings, setRawScreenings] = useState<RawScreening[]>([]);
  const [pendingDoctorsCount, setPendingDoctorsCount] = useState(0);
  
  // Custom Calendar Filter States
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<RangePreset>("all");

  const todayFormatted = format(new Date(), 'yyyy-MM-dd');

  const applyPreset = (preset: Exclude<RangePreset, "custom">) => {
    const today = new Date();
    const end = format(today, "yyyy-MM-dd");

    switch (preset) {
      case "today":
        setStartDate(end);
        setEndDate(end);
        break;
      case "7d":
        setStartDate(format(subDays(today, 6), "yyyy-MM-dd"));
        setEndDate(end);
        break;
      case "30d":
        setStartDate(format(subDays(today, 29), "yyyy-MM-dd"));
        setEndDate(end);
        break;
      case "quarterly":
        setStartDate(format(subDays(today, 89), "yyyy-MM-dd"));
        setEndDate(end);
        break;
      case "yearly":
        setStartDate(format(subDays(today, 364), "yyyy-MM-dd"));
        setEndDate(end);
        break;
      case "all":
        setStartDate("");
        setEndDate("");
        break;
    }
    setSelectedPreset(preset);
  };

  // Fallback Validation
  useEffect(() => {
    if (startDate && endDate) {
      if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
        setStartDate("");
        setEndDate("");
        setSelectedPreset("all");
      }
    }
  }, [startDate, endDate]);

  // 1. Fetch raw data exactly once on mount
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        // Fetch Screenings
        const screeningsSnapshot = await getDocs(collection(db, "screenings"));
        const fetchedData: RawScreening[] = [];
        screeningsSnapshot.forEach((doc) => {
          const data = doc.data();
          let parsedDate: Date | undefined;
          
          if (data.createdAt) {
            parsedDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          } else if (data.timestamp) {
            parsedDate = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          }

          fetchedData.push({
            id: doc.id,
            patientId: data.patientId || 'anonymous',
            aiDiagnosis: data.aiDiagnosis,
            finalDiagnosis: data.finalDiagnosis,
            createdAt: data.createdAt,
            timestamp: data.timestamp,
            dateObj: parsedDate
          });
        });
        setRawScreenings(fetchedData);

        // Fetch Pending Doctors
        const q = query(collection(db, "users"), where("verificationStatus", "==", "pending"));
        const usersSnapshot = await getDocs(q);
        setPendingDoctorsCount(usersSnapshot.size);

      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  // 2. Filter & recalculate derivations dynamically
  const metrics = useMemo(() => {
    // Resolve Absolute Date Hooks
    let startBound: Date | null = null;
    let endBound: Date | null = null;
    
    // Convert HTML5 strings to normalized boundaries
    if (startDate) startBound = startOfDay(new Date(startDate));
    if (endDate) endBound = endOfDay(new Date(endDate));

    const filteredScreenings: RawScreening[] = [];
    
    let total = 0;
    let agreedCount = 0;
    let finalDiagnosisCount = 0;
    let unverifiedCount = 0;
    
    const distributionMap: Record<string, number> = {};
    const volumeMap: Record<string, { ts: number; scans: number }> = {};
    const accuracyMap: Record<string, { total: number, correct: number }> = {};
    const seasonalMap: Record<string, any> = {};
    const seasonalDiseaseKeys = new Set<string>();

    // Central Data Loop
    rawScreenings.forEach((data) => {
      // Bounds Logic
      if (data.dateObj) {
        if (startBound && data.dateObj.getTime() < startBound.getTime()) return;
        if (endBound && data.dateObj.getTime() > endBound.getTime()) return;
      }
      
      // Approved Payload
      filteredScreenings.push(data);
      total++;
      
      if (data.dateObj) {
        const dateStr = format(data.dateObj, 'MMM dd, yyyy');
        const dayTs = startOfDay(data.dateObj).getTime();
        if (!volumeMap[dateStr]) {
          volumeMap[dateStr] = { ts: dayTs, scans: 0 };
        }
        volumeMap[dateStr].scans += 1;
      }

      const ai = data.aiDiagnosis;
      const final = data.finalDiagnosis;

      if (final) {
        finalDiagnosisCount++;
        const isMatch = ai && ai.trim().toLowerCase() === final.trim().toLowerCase();
        if (isMatch) agreedCount++;
        
        if (ai) {
          const aiCat = ai.charAt(0).toUpperCase() + ai.slice(1).toLowerCase();
          if (!accuracyMap[aiCat]) accuracyMap[aiCat] = { total: 0, correct: 0 };
          accuracyMap[aiCat].total++;
          if (isMatch) accuracyMap[aiCat].correct++;
        }
      } else {
        unverifiedCount++;
      }

      const primaryDiagnosis = final || ai;
      if (primaryDiagnosis) {
        const formattedCategory = primaryDiagnosis.charAt(0).toUpperCase() + primaryDiagnosis.slice(1).toLowerCase();
        
        distributionMap[formattedCategory] = (distributionMap[formattedCategory] || 0) + 1;

        if (data.dateObj) {
          const monthSortKey = format(data.dateObj, 'yyyy-MM'); 
          const monthDisplay = format(data.dateObj, 'MMM');     
          
          if (!seasonalMap[monthSortKey]) {
            seasonalMap[monthSortKey] = { sortKey: monthSortKey, displayMonth: monthDisplay };
          }
          
          seasonalMap[monthSortKey][formattedCategory] = (seasonalMap[monthSortKey][formattedCategory] || 0) + 1;
          seasonalDiseaseKeys.add(formattedCategory);
        }
      }
    });

    const rate = finalDiagnosisCount > 0 
      ? Math.round((agreedCount / finalDiagnosisCount) * 100)
      : 0;
    
    // Arrays for Recharts
    const chartData = Object.keys(distributionMap)
      .filter(k => distributionMap[k] > 0)
      .map(key => ({ name: key, value: distributionMap[key] }))
      .sort((a, b) => b.value - a.value); 
      
    const volumeOverTime = Object.entries(volumeMap)
      .map(([date, value]) => ({ date, scans: value.scans, ts: value.ts }))
      .sort((a, b) => a.ts - b.ts)
      .map(({ date, scans }) => ({ date, scans }));
    
    const accuracyByDisease = Object.keys(accuracyMap).map(disease => ({
      name: disease,
      accuracy: Math.round((accuracyMap[disease].correct / accuracyMap[disease].total) * 100)
    }));
    
    const seasonalTrends = Object.values(seasonalMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // Dynamic Insights Calculations
    let highestDisease = "N/A";
    let highestCount = 0;
    
    Object.entries(distributionMap).forEach(([disease, count]) => {
      if (count > highestCount) {
        highestCount = count;
        highestDisease = disease;
      }
    });
    
    const highestPercentage = total > 0 ? Math.round((highestCount / total) * 100) : 0;
    const modelSentence = rate >= 90 ? 'This indicates excellent system reliability.' : 'Review mismatched cases to improve the model.';

    const dynamicInsights = [
      `There were ${total} total scans performed in this period.`,
      total > 0 
        ? `The most frequently detected condition is ${highestDisease}, accounting for ${highestPercentage}% of all scans.`
        : `No conditions were detected during this timeframe.`,
      `The AI is currently operating at an ${rate}% agreement rate with doctors. ${modelSentence}`
    ];

    return {
      totalScans: total,
      totalVerified: finalDiagnosisCount,
      unverifiedCount,
      agreementRate: rate,
      distributionData: chartData,
      volumeOverTime,
      accuracyByDisease,
      filteredScreenings,
      seasonalTrends,
      seasonalDiseaseKeys: Array.from(seasonalDiseaseKeys),
      dynamicInsights
    };
  }, [rawScreenings, startDate, endDate]);


  // 3. Export to CSV Handler
  const downloadCSVReport = () => {
    if (metrics.filteredScreenings.length === 0) return;

    const headers = ["Date", "Patient ID", "AI Diagnosis", "Final Diagnosis", "Match Status"];
    
    const rows = metrics.filteredScreenings.map(doc => {
      const dateStr = doc.dateObj ? format(doc.dateObj, 'yyyy-MM-dd HH:mm:ss') : "Unknown";
      const ai = doc.aiDiagnosis || "N/A";
      const final = doc.finalDiagnosis || "Pending";
      
      let matchStatus = "N/A";
      if (doc.finalDiagnosis && doc.aiDiagnosis) {
        matchStatus = doc.aiDiagnosis.trim().toLowerCase() === doc.finalDiagnosis.trim().toLowerCase() ? "Matched" : "Failed";
      }

      return `"${dateStr}","${doc.patientId}","${ai}","${final}","${matchStatus}"`;
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `OptiTrace_Analytics_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 p-6 md:p-8 pb-10 text-[var(--text)]">
      {/* Header and Filter Control */}
      <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text)]">System Analytics</h1>
            <p className="text-[var(--muted-text)] mt-1">Advanced metrics, data visualization, and reporting.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            
            {/* Custom HTML5 Date Range Filter */}
            <div className="flex flex-wrap items-center gap-2 bg-[var(--background)] border border-[color:var(--soft-border)] px-3 py-2 rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wide">Start</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setSelectedPreset("custom");
                  }}
                  max={endDate || todayFormatted}
                  className="h-10 px-3 bg-[var(--surface)] border border-[color:var(--soft-border-strong)] text-[var(--text)] text-sm rounded-lg focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] outline-none transition-colors"
                />
              </div>
              <span className="text-[var(--muted-text)] px-1">-</span>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wide">End</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setSelectedPreset("custom");
                  }}
                  min={startDate}
                  max={todayFormatted}
                  className="h-10 px-3 bg-[var(--surface)] border border-[color:var(--soft-border-strong)] text-[var(--text)] text-sm rounded-lg focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] outline-none transition-colors"
                />
              </div>
              
              {/* Clear Filters Helper */}
              {(startDate || endDate) && (
                <button 
                  onClick={() => applyPreset("all")}
                  className="ml-1 h-9 px-3 text-xs font-semibold text-[var(--text)] bg-[var(--surface)] hover:opacity-90 rounded-full border border-[color:var(--soft-border)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-[var(--background)] border border-[color:var(--soft-border)] px-3 py-2 rounded-xl shadow-sm">
              <label className="text-xs font-semibold text-[var(--muted-text)] uppercase tracking-wide">Range</label>
              <select
                value={selectedPreset}
                onChange={(e) => {
                  const next = e.target.value as RangePreset;
                  if (next === "custom") {
                    setSelectedPreset("custom");
                    return;
                  }
                  applyPreset(next);
                }}
                className="h-10 min-w-[150px] px-3 bg-[var(--surface)] border border-[color:var(--soft-border-strong)] text-[var(--text)] text-sm rounded-lg focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] outline-none transition-colors"
              >
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="all">All Time</option>
                <option value="custom">Custom (Manual Date)</option>
              </select>
            </div>

            {/* Download CSV Button */}
            <button 
              onClick={downloadCSVReport}
              disabled={metrics.filteredScreenings.length === 0}
              title="Download CSV Report"
              aria-label="Download CSV Report"
              className="h-10 w-10 inline-flex items-center justify-center bg-[var(--primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text)] rounded-lg transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
             <div key={i} className="animate-pulse bg-[var(--surface)] rounded-2xl h-36 border border-[color:var(--soft-border)]"></div>
          ))}
          <div className="animate-pulse bg-[var(--surface)] rounded-2xl h-96 border border-[color:var(--soft-border)] col-span-1 lg:col-span-4"></div>
        </div>
      ) : (
        <>
          {/* Top Level Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-35 group-hover:opacity-55 transition-opacity">
                <svg className="w-16 h-16 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
              </div>
              <h3 className="text-[var(--muted-text)] font-medium text-sm">Total Scans</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-4xl font-bold text-[var(--text)] tracking-tight">{metrics.totalScans}</p>
                <p className="ml-2 text-sm font-medium text-[var(--primary)]">Records</p>
              </div>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-35 group-hover:opacity-55 transition-opacity">
                <svg className="w-16 h-16 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h3 className="text-[var(--muted-text)] font-medium text-sm">Overall Accuracy</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-4xl font-bold text-[var(--text)] tracking-tight">{metrics.agreementRate}%</p>
                <p className="ml-2 text-sm font-medium text-[var(--primary)]">Match Rate</p>
              </div>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-35 group-hover:opacity-55 transition-opacity">
                <svg className="w-16 h-16 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <h3 className="text-[var(--muted-text)] font-medium text-sm">Unverified Scans</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-4xl font-bold text-[var(--text)] tracking-tight">{metrics.unverifiedCount}</p>
                <p className="ml-2 text-sm font-medium text-[var(--muted-text)]">Needs Validation</p>
              </div>
            </div>

            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-35 group-hover:opacity-55 transition-opacity">
                <svg className="w-16 h-16 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <h3 className="text-[var(--muted-text)] font-medium text-sm">Pending Doctors</h3>
              <div className="mt-2 flex items-baseline">
                <p className="text-4xl font-bold text-[var(--text)] tracking-tight">{pendingDoctorsCount}</p>
                <p className="ml-2 text-sm font-medium text-[var(--muted-text)]">Awaiting Approval</p>
              </div>
            </div>
            
          </div>

          {/* New Dynamic Insights Section */}
          <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm">
             <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-[var(--primary)]/35 rounded-lg">
                  <svg className="w-6 h-6 text-[var(--text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--text)]">Automated Insights</h3>
             </div>
             <ul className="space-y-3 pl-4">
               {metrics.dynamicInsights.map((insight, index) => (
                 <li key={index} className="flex items-start text-[var(--muted-text)]">
                    <span className="text-[var(--primary)] mr-3 mt-1">•</span>
                    <span className="leading-relaxed">{insight}</span>
                 </li>
               ))}
             </ul>
          </div>

          {/* Core Analytics Primary Chart (Line Chart over time) */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm">
              <h3 className="text-[var(--text)] font-semibold mb-6">Patient Scanning Volume</h3>
              <div className="h-80 w-full transition-all duration-500">
                {metrics.volumeOverTime.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.volumeOverTime} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--soft-border-strong)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text)" tick={{fill: 'var(--text)'}} />
                      <YAxis stroke="var(--text)" tick={{fill: 'var(--text)'}} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--soft-border-strong)', color: 'var(--text)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--text)' }}
                      />
                      <Line type="monotone" dataKey="scans" stroke="var(--primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--primary)'}} activeDot={{ r: 6, fill: 'var(--primary)', stroke: 'var(--text)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--muted-text)]">
                     <svg className="w-12 h-12 mb-3 text-[var(--muted-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                    No tracking data for this timeframe.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seasonality Chart Section */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm">
              <h3 className="text-[var(--text)] font-semibold mb-6">Disease Seasonality & Calendar Trends</h3>
              <div className="h-[400px] w-full transition-all duration-500">
                {metrics.seasonalTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.seasonalTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--soft-border-strong)" vertical={false} />
                      <XAxis dataKey="displayMonth" stroke="var(--text)" tick={{fill: 'var(--text)'}} />
                      <YAxis stroke="var(--text)" tick={{fill: 'var(--text)'}} allowDecimals={false} />
                      <Tooltip 
                        cursor={{fill: 'var(--row-hover)', opacity: 0.8}}
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--soft-border-strong)', color: 'var(--text)', borderRadius: '8px' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" />
                      
                      {metrics.seasonalDiseaseKeys.map((diseaseKey, idx) => (
                        <Bar 
                          key={diseaseKey} 
                          dataKey={diseaseKey} 
                          fill={SEASONAL_BAR_COLORS[idx % SEASONAL_BAR_COLORS.length]}
                          radius={[4, 4, 0, 0]} 
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--muted-text)]">
                     <svg className="w-12 h-12 mb-3 text-[var(--muted-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    No seasonal data available for this timeframe.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Accuracy by Disease Bar Chart */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm">
              <h3 className="text-[var(--text)] font-semibold mb-6">AI Network Accuracy By Disease (%)</h3>
              <div className="h-80 w-full transition-all duration-500">
                {metrics.accuracyByDisease.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.accuracyByDisease} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--soft-border-strong)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text)" tick={{fill: 'var(--text)'}} />
                      <YAxis stroke="var(--text)" tick={{fill: 'var(--text)'}} domain={[0, 100]} />
                      <Tooltip 
                        cursor={{fill: 'var(--row-hover)', opacity: 0.8}}
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--soft-border-strong)', color: 'var(--text)', borderRadius: '8px' }}
                        itemStyle={{ color: 'var(--text)' }}
                      />
                      <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                        {metrics.accuracyByDisease.map((entry, index) => (
                          <Cell key={`accuracy-cell-${index}`} fill={ACCURACY_BAR_COLORS[index % ACCURACY_BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--muted-text)]">
                    <svg className="w-12 h-12 mb-3 text-[var(--muted-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    No verified accuracies available.
                  </div>
                )}
              </div>
            </div>

            {/* Disease Distribution Pie Chart */}
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[color:var(--soft-border)] shadow-sm">
              <h3 className="text-[var(--text)] font-semibold mb-6">Disease Distribution Breakdown</h3>
              <div className="h-80 w-full transition-all duration-500">
                {metrics.distributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {metrics.distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--soft-border-strong)', color: 'var(--text)', borderRadius: '8px' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--muted-text)]">
                    <svg className="w-12 h-12 mb-3 text-[var(--muted-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4M12 16h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    No scan classifications available.
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
