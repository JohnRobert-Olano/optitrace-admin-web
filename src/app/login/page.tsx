"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Wait for auth to settle and fetch user role
      const uid = userCredential.user.uid;
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === "admin" || userData.role === "master_admin") {
          router.push("/dashboard");
        } else {
          setError("Access Denied: Insufficient privileges.");
          await auth.signOut();
        }
      } else {
        setError("Access Denied: User role not found.");
        await auth.signOut();
      }
    } catch (err: any) {
      console.error(err);
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)] relative overflow-hidden text-[var(--text)] font-sans">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--primary)]/20 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#87b0d2]/10 blur-[120px] rounded-full pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-[420px] p-8 md:p-10 space-y-8 bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-[24px] shadow-[0_12px_40px_rgba(30,41,59,0.12)] relative z-10"
      >
        <div className="text-center flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="w-16 h-16 mb-6 flex items-center justify-center bg-[var(--background)] rounded-full shadow-inner border border-[color:var(--soft-border)] text-[var(--primary)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </motion.div>
          
          <h1 className="text-[28px] font-bold text-[var(--text)] tracking-tight">
            OptiTrace Admin
          </h1>
          <p className="mt-2 text-[14px] text-[var(--muted-text)] tracking-wide">
            Sign in to access your command center
          </p>
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 text-[13px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-[12px] flex items-center justify-center text-center tracking-wide"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <label className="block text-[12px] font-bold text-[var(--muted-text)] tracking-widest uppercase mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 text-[14px] text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border)] rounded-[12px] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all placeholder:text-[var(--muted-text)]/50"
              placeholder="admin@example.com"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <label className="block text-[12px] font-bold text-[var(--muted-text)] tracking-widest uppercase mb-2">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 text-[14px] text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border)] rounded-[12px] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all placeholder:text-[var(--muted-text)]/50"
              placeholder="••••••••"
            />
          </motion.div>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full px-4 py-3 font-bold text-[var(--background)] bg-[color:var(--text)] hover:bg-[color:var(--primary)] hover:text-[color:var(--background)] rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6 shadow-lg"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
