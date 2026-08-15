import { useState } from "react";

export function Onboarding({ user, onUserUpdated }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [collegeEmail, setCollegeEmail] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleRoleSubmit = async (roleToSet) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleToSet }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to set role");
      }
      if (onUserUpdated) onUserUpdated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCollegeEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/verification/college-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit college email");
      }
      setNotice(data.message + " (Token: " + data.token + ")");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIdUploadSubmit = async (e) => {
    e.preventDefault();
    if (!idFile) {
      setError("Please select a file to upload.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);

    const formData = new FormData();
    formData.append("governmentId", idFile);

    try {
      const res = await fetch("/api/verification/landlord-id", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to upload ID document");
      }
      setNotice(data.message);
      if (onUserUpdated) onUserUpdated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 1: ROLE SELECTION (if role is unset)
  if (!user.role) {
    return (
      <div className="auth-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h3>Welcome to RoomieMatch!</h3>
        <p style={{ color: "#94a3b8" }}>Please select your account role to continue:</p>
        {error && <div className="error-alert">{error}</div>}

        <div style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          <div
            className={`card ${selectedRole === "seeker" ? "selected-card" : ""}`}
            style={{ cursor: "pointer", border: selectedRole === "seeker" ? "2px solid #6366f1" : "1px solid #334155" }}
            onClick={() => setSelectedRole("seeker")}
          >
            <h4>🎓 Seeker</h4>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              Student looking for a room, flat, or PG bed in the city.
            </p>
          </div>

          <div
            className={`card ${selectedRole === "resident" ? "selected-card" : ""}`}
            style={{ cursor: "pointer", border: selectedRole === "resident" ? "2px solid #6366f1" : "1px solid #334155" }}
            onClick={() => setSelectedRole("resident")}
          >
            <h4>🏠 Resident Space-holder</h4>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              Current tenant living in a flat/PG with a spare bed or room to fill.
            </p>
          </div>

          <div
            className={`card ${selectedRole === "landlord" ? "selected-card" : ""}`}
            style={{ cursor: "pointer", border: selectedRole === "landlord" ? "2px solid #6366f1" : "1px solid #334155" }}
            onClick={() => setSelectedRole("landlord")}
          >
            <h4>🔑 Landlord / Property Owner</h4>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              Property owner or PG manager (non-resident) listing accommodations.
            </p>
          </div>
        </div>

        <button
          style={{ marginTop: "1.5rem", width: "100%" }}
          disabled={!selectedRole || loading}
          onClick={() => handleRoleSubmit(selectedRole)}
        >
          {loading ? "Saving Role..." : "Continue with Selected Role"}
        </button>
      </div>
    );
  }

  // STEP 2: VERIFICATION (if role set but status is not 'verified')
  const isVerified = user.platformVerification?.status === "verified";
  const isSeekerOrResident = user.role === "seeker" || user.role === "resident";

  if (!isVerified) {
    return (
      <div className="auth-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <h3>Platform Verification Required</h3>
        <p style={{ color: "#94a3b8" }}>
          Current Role: <strong style={{ color: "#a5b4fc" }}>{user.role.toUpperCase()}</strong> | Status:{" "}
          <span className="badge badge-warning">{user.platformVerification?.status || "pending"}</span>
        </p>

        {error && <div className="error-alert">{error}</div>}
        {notice && <div className="status-notice">{notice}</div>}

        {isSeekerOrResident ? (
          <div>
            <h4>🎓 College Affiliation Verification (US-2)</h4>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              To ensure platform safety, students must verify a college email address (@stanford.edu, @mit.edu, @iit.ac.in, etc.).
            </p>
            <form onSubmit={handleCollegeEmailSubmit} style={{ marginTop: "1rem" }}>
              <div className="form-group">
                <label>Secondary College Email</label>
                <input
                  type="email"
                  required
                  value={collegeEmail}
                  onChange={(e) => setCollegeEmail(e.target.value)}
                  placeholder="student@university.edu"
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? "Generating Link..." : "Send Verification Link"}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <h4>🔑 Landlord ID Verification (US-3)</h4>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              Property owners must upload a government ID (Driver's License, Passport, or Aadhar) for manual admin review.
            </p>

            {user.platformVerification?.idDocumentUrl ? (
              <div className="status-notice" style={{ marginTop: "1rem" }}>
                <p><strong>✅ ID Document Uploaded:</strong> {user.platformVerification.idDocumentUrl}</p>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                  Status: <strong>PENDING ADMIN REVIEW</strong>. (Note: No admin approval UI exists yet — verifications sit at pending until manually reviewed or set in DB).
                </p>
                <a
                  href={user.platformVerification.idDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#818cf8", fontSize: "0.9rem" }}
                >
                  🔒 View My Uploaded ID Document (Protected Route)
                </a>
              </div>
            ) : (
              <form onSubmit={handleIdUploadSubmit} style={{ marginTop: "1rem" }}>
                <div className="form-group">
                  <label>Government ID Document (Image or PDF)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    required
                    onChange={(e) => setIdFile(e.target.files[0])}
                  />
                </div>
                <button type="submit" disabled={loading}>
                  {loading ? "Uploading Document..." : "Upload Government ID"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h3>✅ Onboarding & Platform Verification Complete!</h3>
      <p>Role: <strong>{user.role}</strong></p>
      <p>Verification Method: <strong>{user.platformVerification?.method}</strong></p>
    </div>
  );
}
