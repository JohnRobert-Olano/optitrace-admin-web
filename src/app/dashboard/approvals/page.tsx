"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ReasonModal from "@/app/dashboard/components/ReasonModal";
import { ImageIcon } from "lucide-react";

interface ApprovalUser {
  id: string;
  name: string;
  email: string;
  badgeUrl: string;
  verificationStatus: string;
}

export default function ApprovalsPage() {
  const [users, setUsers] = useState<ApprovalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ApprovalUser | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("verificationStatus", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData: ApprovalUser[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          name: data.displayName || "Unknown",
          email: data.email || "No Email",
          badgeUrl: data.badgeUrl || "",
          verificationStatus: data.verificationStatus,
        });
      });
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching approvals:", error);
      setMessage({ type: 'error', text: "Failed to load pending approvals." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (
    userId: string,
    userName: string,
    userEmail: string,
    newStatus: 'approved' | 'rejected'
  ) => {
    try {
      const userRef = doc(db, "users", userId);
      const updateData: any = {
        verificationStatus: newStatus
      };
      
      if (newStatus === 'approved') {
        updateData.role = 'doctor';
      } else {
        updateData.verificationStatus = 'none';
      }

      await updateDoc(userRef, updateData);

      if (newStatus === 'approved') {
        await fetch('/api/send-approval-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userEmail, doctorName: userName }),
        });
      }

      setMessage({ 
        type: 'success', 
        text: `Doctor successfully ${newStatus}${newStatus === 'approved' ? ' and email sent' : ''}.`
      });
      
      // Auto-clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Error updating status:", error);
      setMessage({ 
        type: 'error', 
        text: `Failed to ${newStatus === 'approved' ? 'approve' : 'reject'} doctor. Please try again.`
      });
    }
  };

  const handleRejectWithReason = async (rejectionReason: string) => {
    if (!rejectTarget) return;
    try {
      setRejectLoading(true);
      const userRef = doc(db, "users", rejectTarget.id);
      await updateDoc(userRef, { verificationStatus: "none" });

      await fetch('/api/send-rejection-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: rejectTarget.email,
          name: rejectTarget.name,
          rejectionReason
        }),
      });

      setMessage({
        type: 'success',
        text: "Doctor application rejected and email sent."
      });
      setTimeout(() => setMessage(null), 3000);
      setRejectTarget(null);
    } catch (error: any) {
      console.error("Error rejecting doctor:", error);
      setMessage({
        type: 'error',
        text: "Failed to reject doctor. Please try again."
      });
    } finally {
      setRejectLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8 pb-8 text-[var(--text)]">
      <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6">
        <h1 className="text-3xl font-bold text-[var(--text)]">Pending Approvals</h1>
        <p className="text-[var(--muted-text)] mt-1">Review and verify doctor sign-up requests.</p>
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
                      Loading approvals...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted-text)]">
                    <p className="text-lg text-[var(--text)]">No pending approvals</p>
                    <p className="text-sm mt-1 text-[var(--muted-text)]">You're all caught up!</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--row-hover)] transition-colors">
                    <td className="px-6 py-4 text-[var(--text)] font-medium">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-text)]">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      {user.badgeUrl ? (
                        <a 
                          href={user.badgeUrl} 
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRejectTarget(user)}
                          className="min-w-[72px] px-4 py-1.5 text-sm font-semibold text-[#416085] bg-[#dce4ec] hover:bg-[#cfdbe7] rounded-full border border-[#d1dbe6] transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(user.id, user.name, user.email, 'approved')}
                          className="min-w-[82px] px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-[#7ea9cf] to-[#5f87ad] hover:from-[#739fc7] hover:to-[#547da5] rounded-full border border-[#6f97bd] shadow-[0_2px_8px_rgba(95,135,173,0.25)] transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReasonModal
        isOpen={!!rejectTarget}
        title="Reject Doctor Application"
        description={`Provide a clear reason for rejecting ${rejectTarget?.name ?? "this doctor's"} verification request.`}
        confirmLabel="Reject Application"
        placeholder="Enter rejection reason..."
        loading={rejectLoading}
        onClose={() => !rejectLoading && setRejectTarget(null)}
        onConfirm={handleRejectWithReason}
      />
    </div>
  );
}
