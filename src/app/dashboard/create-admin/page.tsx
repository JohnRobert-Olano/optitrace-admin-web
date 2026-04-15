"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function CreateAdminPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Only master_admin can access this page
    const checkAccess = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data()?.role === "master_admin") {
          setCheckingRole(false);
        } else {
          router.push("/dashboard?error=access_denied");
        }
      } catch (err) {
        router.push("/dashboard?error=server_error");
      }
    };

    // auth layout should have settled the auth state already 
    // but we can also wait for auth explicitly if needed
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAccess();
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch("/api/create-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: "Admin created successfully!" });
        setName("");
        setEmail("");
        setPassword("");
      } else {
        setMessage({ type: 'error', text: data.error || "Failed to create admin." });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8 pb-10 text-[var(--text)]">
      <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6">
        <h1 className="text-3xl font-bold text-[var(--text)]">Create New Admin</h1>
        <p className="text-[var(--muted-text)] mt-1">
          Fill in the details below to provision a new administrator account.
        </p>
      </div>

      <div className="p-6 bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)]">

        {message && (
          <div className={`p-4 mb-6 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
              : 'bg-red-500/10 border-red-500/30 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border-strong)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border-strong)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="admin@optitrace.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">Temporary Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border-strong)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2 font-semibold text-[var(--text)] bg-[var(--primary)] rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating..." : "Create Admin Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
