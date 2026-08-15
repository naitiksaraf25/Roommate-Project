import { useState } from "react";

export function ProtectedTest() {
  const [response, setResponse] = useState(null);
  const [verifiedResponse, setVerifiedResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProtectedEndpoint = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/protected-sample", {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status} ${data.error}`);
      }
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifiedEndpoint = async () => {
    setLoading(true);
    setError(null);
    setVerifiedResponse(null);

    try {
      const res = await fetch("/api/verified-sample", {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status} ${data.error}`);
      }
      setVerifiedResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card" style={{ marginTop: "1rem" }}>
      <h3>Middleware Guard Testers</h3>
      <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
        Test accessing <code>requireAuth</code> vs <code>requireVerified</code> endpoints.
      </p>

      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", margin: "1rem 0" }}>
        <button onClick={fetchProtectedEndpoint} disabled={loading}>
          Test requireAuth
        </button>
        <button onClick={fetchVerifiedEndpoint} disabled={loading} style={{ background: "#4f46e5" }}>
          Test requireVerified
        </button>
      </div>

      {error && (
        <div className="error-alert" style={{ marginTop: "1rem" }}>
          Access Denied: {error}
        </div>
      )}

      {response && (
        <div className="status-notice" style={{ marginTop: "1rem", textAlign: "left" }}>
          <h4>requireAuth Response (HTTP 200 Authorized):</h4>
          <pre style={{ fontSize: "0.85rem", overflowX: "auto" }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}

      {verifiedResponse && (
        <div className="status-notice" style={{ marginTop: "1rem", textAlign: "left", borderColor: "#6366f1" }}>
          <h4>requireVerified Response (HTTP 200 Platform Verified):</h4>
          <pre style={{ fontSize: "0.85rem", overflowX: "auto" }}>
            {JSON.stringify(verifiedResponse, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
