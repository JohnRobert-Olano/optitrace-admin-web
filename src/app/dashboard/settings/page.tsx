"use client";

import { useEffect, useState } from "react";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase";

type ThemeMode = "light" | "dark";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");

  const applyTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    localStorage.setItem("optitrace-theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.dispatchEvent(new CustomEvent("optitrace-theme-change", { detail: nextTheme }));
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("optitrace-theme") as ThemeMode | null;
    const initialTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: "New passwords do not match." });
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: "Password must be at least 6 characters long." });
      setLoading(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("No authenticated user found.");
      }

      if (!user.email) {
        throw new Error("User does not have an associated email address.");
      }

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Now we can update the password safely
      await updatePassword(user, newPassword);
      
      setMessage({ type: 'success', text: "Password updated successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Error updating password:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setMessage({ 
          type: 'error', 
          text: "Incorrect current password." 
        });
      } else if (err.code === "auth/requires-recent-login") {
        setMessage({ 
          type: 'error', 
          text: "For security, please log out and log back in before changing your password." 
        });
      } else {
        setMessage({ type: 'error', text: err.message || "An unexpected error occurred." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8 pb-10">
      <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6">
        <h1 className="text-3xl font-bold text-[var(--text)]">Settings</h1>
        <p className="text-[var(--muted-text)] mt-1">Manage your appearance preferences and account security.</p>
      </div>

      <div className="p-6 bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)]">
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Theme Preferences</h2>
        <p className="text-[var(--muted-text)] mb-5">Choose how the dashboard should appear.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => applyTheme("light")}
            className={`p-4 rounded-xl border text-left transition-all ${
              theme === "light"
                ? "bg-[var(--primary)]/40 border-[var(--primary)] shadow-[0_0_0_2px_rgba(126,169,207,0.25)]"
                : "bg-[var(--background)] border-[color:var(--soft-border)] hover:bg-[var(--surface)]"
            }`}
          >
            <p className="text-sm font-semibold text-[var(--text)]">Light Mode</p>
            <p className="text-xs text-[var(--muted-text)] mt-1">Bright surfaces and high readability.</p>
          </button>

          <button
            type="button"
            onClick={() => applyTheme("dark")}
            className={`p-4 rounded-xl border text-left transition-all ${
              theme === "dark"
                ? "bg-[var(--primary)]/40 border-[var(--primary)] shadow-[0_0_0_2px_rgba(126,169,207,0.25)]"
                : "bg-[var(--background)] border-[color:var(--soft-border)] hover:bg-[var(--surface)]"
            }`}
          >
            <p className="text-sm font-semibold text-[var(--text)]">Dark Mode</p>
            <p className="text-xs text-[var(--muted-text)] mt-1">Dimmer interface for low-light use.</p>
          </button>
        </div>
      </div>
      
      <div className="p-6 bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)]">
        <h2 className="text-xl font-semibold text-[var(--text)] mb-4">Change Password</h2>
        <p className="text-[var(--muted-text)] mb-6">
          Update your account password. For your security, we recommend using a strong password. You must verify your current password to make changes.
        </p>

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
            <label className="block text-sm font-medium text-[var(--text)]">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border-strong)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="••••••••"
            />
          </div>
          <div className="border-t border-[color:var(--soft-border)] my-4 pt-4"></div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 mt-1 text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border-strong)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text)]">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
