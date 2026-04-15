"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import { 
  Home, 
  ClipboardCheck, 
  Users, 
  LineChart, 
  Settings, 
  LogOut,
  ShieldAlert,
  UserCog
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedTheme = localStorage.getItem("optitrace-theme");
    const initialTheme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === "admin" || userData.role === "master_admin") {
              setRole(userData.role);
              setAuthorized(true);
            } else {
              await auth.signOut();
              router.push("/login?error=access_denied");
            }
          } else {
            await auth.signOut();
            router.push("/login?error=not_found");
          }
        } catch (err) {
          console.error("Error fetching user role:", err);
          router.push("/login?error=server_error");
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="w-10 h-10 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Will redirect in useEffect
  }

  const handleLogout = async () => {
    await auth.signOut();
    router.push("/login");
  };

  const mainItems = [
    { name: "Overview", href: "/dashboard", Icon: Home },
    { name: "Approvals", href: "/dashboard/approvals", Icon: ClipboardCheck },
    { name: "Manage Doctors", href: "/dashboard/manage-doctors", Icon: Users },
    { name: "Analytics", href: "/dashboard/analytics", Icon: LineChart },
  ];

  if (role === "master_admin") {
    mainItems.push({ name: "Create Admin", href: "/dashboard/create-admin", Icon: ShieldAlert });
    mainItems.push({ name: "Manage Roles", href: "/dashboard/manage-roles", Icon: UserCog });
  }

  const baseIconClass = "p-3 rounded-full transition-all duration-300";
  const inactiveClass = `text-[var(--muted-text)] hover:text-[var(--text)] hover:bg-[var(--row-hover)] ${baseIconClass}`;
  const activeClass = `text-[var(--text)] bg-[var(--primary)] shadow-[0_0_15px_rgba(126,169,207,0.35)] ${baseIconClass}`;

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--text)] font-sans">
      
      {/* Floating Glass Pill Sidebar */}
      <aside className="m-6 h-[calc(100vh-3rem)] w-20 shrink-0 flex flex-col items-center py-8 rounded-[40px] z-50 bg-[var(--surface)] border border-[color:var(--soft-border)] shadow-lg">
        
        {/* App Logo Placeholder */}
        <div className="mb-10 shrink-0">
          <div className="w-10 h-10 bg-[var(--primary)] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(126,169,207,0.35)]">
            <span className="text-[var(--text)] font-bold text-lg">O</span>
          </div>
        </div>

        {/* Top Feature Nav */}
        <nav className="flex items-center flex-col gap-6 w-full shrink-0">
          {mainItems.map((item) => {
            const isActive = pathname === item.href;
            const IconComponent = item.Icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={isActive ? activeClass : inactiveClass}
                title={item.name}
              >
                 <IconComponent className="w-6 h-6 shrink-0" />
              </Link>
            );
          })}
        </nav>

        {/* Bottom Utility Nav */}
        <div className="mt-auto flex flex-col items-center gap-6 w-full shrink-0">
          <Link 
            href="/dashboard/settings" 
            className={pathname === "/dashboard/settings" ? activeClass : inactiveClass}
            title="Settings"
          >
             <Settings className="w-6 h-6 shrink-0" />
          </Link>

          <button
            onClick={handleLogout}
            className={inactiveClass}
            title="Sign Out"
          >
             <LogOut className="w-6 h-6 shrink-0" />
          </button>
        </div>

      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 h-full w-full overflow-y-auto">
          {children}
        </div>
      </main>

    </div>
  );
}
