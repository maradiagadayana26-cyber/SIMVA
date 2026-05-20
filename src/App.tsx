/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { AuthPage } from "./components/auth/AuthPage";
import { AppLayout } from "./components/layout/AppLayout";
import { Splash } from "./components/ui/Splash";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "./components/ui/CookieBanner";
import { initOneSignal, isOneSignalReady } from "./lib/onesignal";
import OneSignal from "react-onesignal";

function ThemeManager({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  
  useEffect(() => {
    if (!profile) return;
    
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    
    if (profile.app_theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(profile.app_theme);
    }
  }, [profile]);

  return <>{children}</>;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    initOneSignal();
  }, []);

  useEffect(() => {
    if (user?.email && user?.uid) {
      const syncUser = async () => {
        try {
          // Wait for initialization to be complete
          await initOneSignal();
          
          // Extra safety check post-await: Check if it actually succeeded
          if (!isOneSignalReady()) {
            console.warn("OneSignal initialization was not successful, skipping user sync.");
            return;
          }

          // Small delay to ensure internal SDK state (like User) is populated
          await new Promise(resolve => setTimeout(resolve, 1000));

          if (typeof OneSignal === 'undefined') {
            console.warn("OneSignal global reference is undefined, skipping user sync.");
            return;
          }

          // Sync user ID with OneSignal inside a dedicated try-catch
          try {
            if ((OneSignal as any).login) {
              await OneSignal.login(user.uid);
              console.log("OneSignal user login executed successfully: ", user.uid);
            } else {
              console.warn("OneSignal.login function is not available on the SDK.");
            }
          } catch (loginErr) {
            console.error("Error executing OneSignal.login:", loginErr);
          }
          
          // Set email alias inside a dedicated try-catch
          try {
            if ((OneSignal as any).User && typeof (OneSignal as any).User.addAlias === 'function') {
              await (OneSignal as any).User.addAlias("email", user.email);
              console.log("OneSignal user email alias added successfully.");
            } else {
              console.warn("OneSignal.User.addAlias is unavailable, skipping alias sync.");
            }
          } catch (aliasErr) {
            console.error("Error adding OneSignal alias:", aliasErr);
          }
        } catch (err) {
          console.error("Unexpected error syncing OneSignal user:", err);
        }
      };
      syncUser();
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [loading]);

  if (showSplash) return <Splash />;
  
  if (!user) return <AuthPage />;

  return <AppLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ThemeManager>
          <div className="selection:bg-primary/20">
            <AppContent />
            <CookieBanner />
            <Toaster position="top-center" richColors />
          </div>
        </ThemeManager>
      </NotificationProvider>
    </AuthProvider>
  );
}

