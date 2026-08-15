import { useState, useEffect } from "react";
import { useSession, signOut } from "./lib/auth-client";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { ForgotPassword } from "./components/ForgotPassword";
import { EmailVerification } from "./components/EmailVerification";
import { Onboarding } from "./components/Onboarding";
import { LifestyleProfileForm } from "./components/LifestyleProfileForm";
import { LandlordListingForm } from "./components/LandlordListingForm";
import { ProtectedTest } from "./components/ProtectedTest";
import "./index.css";

export function App() {
  const { data: sessionData, isPending, refetch } = useSession();
  const [activeTab, setActiveTab] = useState("login"); // 'login' | 'signup' | 'verify' | 'forgot'
  const [activeView, setActiveView] = useState("profile"); // 'profile' | 'onboarding'
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await signOut();
    refetch();
  };

  const user = sessionData?.user;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "1rem" }}>
      <h1>RoomieMatch</h1>
      <p style={{ color: "#94a3b8", fontSize: "1.1rem" }}>
        Prompt 4 — Lifestyle Profiles & Landlord Listings
      </p>

      {/* Backend & DB Status Ribbon */}
      {health && (
        <div style={{ marginBottom: "1.5rem", fontSize: "0.85rem", color: "#94a3b8" }}>
          Server Status: <span className="badge badge-success">{health.status}</span> | MongoDB:{" "}
          <span className={`badge ${health.mongodb === "connected" ? "badge-success" : "badge-warning"}`}>
            {health.mongodb}
          </span>
        </div>
      )}

      {isPending ? (
        <div className="card">Loading session state...</div>
      ) : user ? (
        /* Authenticated View */
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>Welcome, {user.name || user.email}!</h2>
            <button onClick={handleLogout} style={{ background: "#ef4444" }}>Log Out</button>
          </div>

          <div className="status-notice" style={{ textAlign: "left", margin: "1rem 0" }}>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Email:</strong> {user.email} {user.emailVerified ? "✅ Verified" : "⚠️ Unverified"}</p>
            <p><strong>Role:</strong> <span style={{ color: user.role ? "#a5b4fc" : "#f59e0b" }}>{user.role ? user.role.toUpperCase() : "UNSET (Onboarding Required)"}</span></p>
            <p><strong>Account Status:</strong> {user.accountStatus || "active"}</p>
            <p><strong>Platform Verification:</strong> {user.platformVerification?.status || "pending"} (Method: {user.platformVerification?.method || "N/A"})</p>
          </div>

          {/* Onboarding vs Profile View Routing */}
          {!user.role ? (
            <Onboarding user={user} onUserUpdated={() => refetch()} />
          ) : (
            <div>
              <div className="tab-bar" style={{ justifyContent: "center", marginBottom: "1rem" }}>
                <button
                  className={activeView === "profile" ? "active" : ""}
                  onClick={() => setActiveView("profile")}
                >
                  {user.role === "landlord" ? "Property Listing Form" : "Lifestyle Profile Form"}
                </button>
                <button
                  className={activeView === "onboarding" ? "active" : ""}
                  onClick={() => setActiveView("onboarding")}
                >
                  Verification Status
                </button>
              </div>

              {activeView === "onboarding" && (
                <Onboarding user={user} onUserUpdated={() => refetch()} />
              )}

              {activeView === "profile" && (
                <div>
                  {(user.role === "seeker" || user.role === "resident") && (
                    <LifestyleProfileForm user={user} onProfileSaved={() => refetch()} />
                  )}

                  {user.role === "landlord" && (
                    <LandlordListingForm user={user} onListingSaved={() => refetch()} />
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ margin: "1.5rem 0", display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button onClick={() => refetch()}>Refresh Session</button>
          </div>

          <ProtectedTest />
        </div>
      ) : (
        /* Unauthenticated View */
        <div>
          <div className="tab-bar">
            <button
              className={activeTab === "login" ? "active" : ""}
              onClick={() => setActiveTab("login")}
            >
              Sign In
            </button>
            <button
              className={activeTab === "signup" ? "active" : ""}
              onClick={() => setActiveTab("signup")}
            >
              Create Account
            </button>
            <button
              className={activeTab === "verify" ? "active" : ""}
              onClick={() => setActiveTab("verify")}
            >
              Verify Email Token
            </button>
            <button
              className={activeTab === "forgot" ? "active" : ""}
              onClick={() => setActiveTab("forgot")}
            >
              Reset Password
            </button>
          </div>

          {activeTab === "login" && (
            <Login
              onLoginSuccess={() => refetch()}
              onToggleForgotPassword={() => setActiveTab("forgot")}
            />
          )}

          {activeTab === "signup" && (
            <Signup onSignupSuccess={() => setActiveTab("login")} />
          )}

          {activeTab === "verify" && (
            <EmailVerification onVerificationComplete={() => setActiveTab("login")} />
          )}

          {activeTab === "forgot" && (
            <ForgotPassword onBackToLogin={() => setActiveTab("login")} />
          )}

          <ProtectedTest />
        </div>
      )}
    </div>
  );
}

export default App;
