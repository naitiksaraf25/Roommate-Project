import { useState } from "react";

export function ProtectedTest() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProtectedEndpoint = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/protected-sample", {
        headers: {
          "Content-Type": "application/json",
        },
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

  return (
    <div className="auth-card" style={{ marginTop: "1rem" }}>
      <h3>Protected Route Middleware Tester</h3>
      <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
        Test accessing <code>GET /api/protected-sample</code> guarded by <code>requireAuth</code>.
      </p>

      <button onClick={fetchProtectedEndpoint} disabled={loading}>
        {loading ? "Requesting..." : "Test Protected Route"}
      </button>

      {error && (
        <div className="error-alert" style={{ marginTop: "1rem" }}>
          Access Denied: {error}
        </div>
      )}

      {response && (
        <div className="status-notice" style={{ marginTop: "1rem", textAlign: "left" }}>
          <h4>Response Data (HTTP 200 Authorized):</h4>
          <pre style={{ fontSize: "0.85rem", overflowX: "auto" }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
