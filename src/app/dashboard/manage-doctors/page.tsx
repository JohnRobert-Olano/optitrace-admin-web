"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ReasonModal from "@/app/dashboard/components/ReasonModal";
import { ImageIcon } from "lucide-react";

interface ActiveDoctor {
  id: string;
  name: string;
  email: string;
  badgeUrl: string;
  verificationStatus: string;
  role: string;
}

export default function ManageDoctorsPage() {
  const [doctors, setDoctors] = useState<ActiveDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ActiveDoctor | null>(null);

  useEffect(() => {
    // Query users where role is doctor AND verificationStatus is approved
    const q = query(
      collection(db, "users"),
      where("role", "==", "doctor"),
      where("verificationStatus", "==", "approved")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const doctorsData: ActiveDoctor[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        doctorsData.push({
          id: doc.id,
          name: data.displayName || "Unknown",
          email: data.email || "No Email",
          badgeUrl: data.badgeUrl || "",
          verificationStatus: data.verificationStatus,
          role: data.role,
        });
      });
      setDoctors(doctorsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching active doctors:", error);
      setMessage({ type: 'error', text: "Failed to load active doctors." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRevokeAccess = async (revokeReason: string) => {
    if (!revokeTarget) return;
    try {
      setRevokeLoading(true);
      const userRef = doc(db, "users", revokeTarget.id);
      await updateDoc(userRef, {
        verificationStatus: "none",
        role: "patient"
      });

      await fetch('/api/send-revoke-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: revokeTarget.email,
          name: revokeTarget.name,
          revokeReason
        }),
      });

      setMessage({ 
        type: 'success', 
        text: "Access successfully revoked and notification email sent."
      });
      
      setTimeout(() => setMessage(null), 3000);
      setRevokeTarget(null);
    } catch (error: any) {
      console.error("Error revoking access:", error);
      setMessage({ 
        type: 'error', 
        text: "Failed to revoke doctor access. Please try again."
      });
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8 pb-8 text-[var(--text)]">
      <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6">
        <h1 className="text-3xl font-bold text-[var(--text)]">Manage Doctors</h1>
        <p className="text-[var(--muted-text)] mt-1">View active doctors and manage their access privileges.</p>
      </div>
      
      {message && (
        <div className={`p-4 rounded-lg text-sm border ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
            : 'bg-red-500/10 border-red-500/30 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="overflow-hidden bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--background)] border-b border-[color:var(--soft-border)] text-[var(--muted-text)] text-sm">
                <th className="px-6 py-4 font-medium">Doctor Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">ID / Badge</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--soft-border)]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--muted-text)]">
                    <div className="flex justify-center items-center">
                      <div className="w-6 h-6 border-2 border-[#9ABDDC] border-t-transparent rounded-full animate-spin mr-3"></div>
                      Loading active doctors...
                    </div>
                  </td>
                </tr>
              ) : doctors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted-text)]">
                    <p className="text-lg text-[var(--text)]">No active doctors found.</p>
                    <p className="text-sm mt-1 text-[var(--muted-text)]">Approved doctors will appear here.</p>
                  </td>
                </tr>
              ) : (
                doctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-[var(--row-hover)] transition-colors">
                    <td className="px-6 py-4 text-[var(--text)] font-medium">
                      {doctor.name}
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-text)]">
                      {doctor.email}
                    </td>
                    <td className="px-6 py-4">
                      {doctor.badgeUrl ? (
                        <a 
                          href={doctor.badgeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[var(--text)] bg-[var(--background)] hover:bg-[var(--surface)] rounded-full border border-[color:var(--soft-border-strong)] transition-colors"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>View Image</span>
                        </a>
                      ) : (
                        <span className="text-[var(--muted-text)] text-sm italic">No image provided</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setRevokeTarget(doctor)}
                        className="min-w-[112px] px-4 py-1.5 text-sm font-semibold text-[#416085] bg-[#dce4ec] hover:bg-[#cfdbe7] rounded-full border border-[#d1dbe6] transition-colors"
                      >
                        Revoke Access
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReasonModal
        isOpen={!!revokeTarget}
        title="Revoke Doctor Access"
        description={`Provide a reason for revoking ${revokeTarget?.name ?? "this doctor's"} access.`}
        confirmLabel="Revoke Access"
        placeholder="Enter revocation reason..."
        loading={revokeLoading}
        onClose={() => !revokeLoading && setRevokeTarget(null)}
        onConfirm={handleRevokeAccess}
      />
    </div>
  );
}
