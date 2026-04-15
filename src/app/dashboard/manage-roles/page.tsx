"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

type UserRole = "patient" | "doctor" | "admin" | "master_admin";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

const ROLE_OPTIONS: UserRole[] = ["patient", "doctor", "admin", "master_admin"];

export default function ManageRolesPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        router.push("/login");
        return;
      }

      const currentDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (!currentDoc.exists() || currentDoc.data()?.role !== "master_admin") {
        router.push("/dashboard?error=access_denied");
        return;
      }
      setAccessGranted(true);
      setCheckingAccess(false);
    };

    setCheckingAccess(true);
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      await checkAccess();
    });
  }, [router]);

  useEffect(() => {
    if (!accessGranted || !passwordVerified) return;

    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const rows: UserRow[] = [];
      const nextDrafts: Record<string, UserRole> = {};
      snapshot.forEach((userDoc) => {
        const data = userDoc.data();
        const role = (data.role || "patient") as UserRole;
        rows.push({
          id: userDoc.id,
          name: data.displayName || data.name || "Unknown",
          email: data.email || "No Email",
          role,
        });
        nextDrafts[userDoc.id] = role;
      });

      rows.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(rows);
      setDraftRoles((prev) => ({ ...nextDrafts, ...prev }));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [accessGranted, passwordVerified]);

  const handlePasswordVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    try {
      setVerifyingPassword(true);
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Authenticated user email is required.");

      const credential = EmailAuthProvider.credential(user.email, passwordInput);
      await reauthenticateWithCredential(user, credential);

      setPasswordVerified(true);
      setPasswordInput("");
    } catch (error: any) {
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        setPasswordError("Incorrect password. Please try again.");
      } else {
        setPasswordError(error.message || "Failed to verify password.");
      }
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleSaveRole = async (userId: string) => {
    const nextRole = draftRoles[userId];
    if (!nextRole) return;

    try {
      setSavingId(userId);
      setMessage(null);
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error("Not authenticated");

      const response = await fetch("/api/update-user-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ userId, role: nextRole }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update role.");
      }

      setMessage({ type: "success", text: "User role updated successfully." });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update role." });
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!passwordVerified) {
    return (
      <div className="space-y-6 p-6 md:p-8 pb-10 text-[var(--text)]">
        <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6">
          <h1 className="text-3xl font-bold text-[var(--text)]">Manage User Roles</h1>
          <p className="text-[var(--muted-text)] mt-1">
            For security, confirm your account password before entering role management.
          </p>
        </div>

        <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6 max-w-xl">
          <form onSubmit={handlePasswordVerification} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)]">Confirm Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2 mt-1 text-[var(--text)] bg-[var(--background)] border border-[color:var(--soft-border-strong)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                placeholder="••••••••"
              />
            </div>

            {passwordError && (
              <div className="p-3 rounded-lg text-sm border bg-red-500/10 border-red-500/30 text-red-700">
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingPassword}
              className="px-6 py-2 font-semibold text-[var(--text)] bg-[var(--primary)] rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {verifyingPassword ? "Verifying..." : "Unlock Manage Roles"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8 pb-10 text-[var(--text)]">
      <div className="bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)] p-6">
        <h1 className="text-3xl font-bold text-[var(--text)]">Manage User Roles</h1>
        <p className="text-[var(--muted-text)] mt-1">
          Master admins can update roles for every user in the database.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm border ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
              : "bg-red-500/10 border-red-500/30 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-hidden bg-[var(--surface)] border border-[color:var(--soft-border)] rounded-2xl shadow-[0_8px_20px_rgba(30,41,59,0.08)]">
        <div className="p-4 border-b border-[color:var(--soft-border)] bg-[var(--background)]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search user by name..."
            className="w-full md:max-w-sm h-10 px-3 bg-[var(--surface)] border border-[color:var(--soft-border-strong)] text-[var(--text)] text-sm rounded-lg focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] outline-none transition-colors"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--background)] border-b border-[color:var(--soft-border)] text-[var(--muted-text)] text-sm">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--soft-border)]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-[var(--muted-text)]">
                    <div className="flex justify-center items-center">
                      <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mr-3"></div>
                      Loading users...
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[var(--muted-text)]">
                    {users.length === 0 ? "No users found." : "No users match your search."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const selectedRole = draftRoles[user.id] || user.role;
                  const changed = selectedRole !== user.role;
                  const isSaving = savingId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-[var(--row-hover)] transition-colors">
                      <td className="px-6 py-4 text-[var(--text)] font-medium">{user.name}</td>
                      <td className="px-6 py-4 text-[var(--muted-text)]">{user.email}</td>
                      <td className="px-6 py-4">
                        <select
                          value={selectedRole}
                          onChange={(e) =>
                            setDraftRoles((prev) => ({ ...prev, [user.id]: e.target.value as UserRole }))
                          }
                          className="h-10 px-3 bg-[var(--background)] border border-[color:var(--soft-border-strong)] text-[var(--text)] text-sm rounded-lg focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] outline-none transition-colors"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          disabled={!changed || isSaving}
                          onClick={() => handleSaveRole(user.id)}
                          className="min-w-[84px] px-4 py-1.5 text-sm font-semibold text-[var(--text)] bg-[var(--primary)] rounded-full border border-[color:var(--soft-border-strong)] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-colors"
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
