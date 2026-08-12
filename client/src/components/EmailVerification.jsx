import { useState, useEffect } from "react";
import { authClient } from "../lib/auth-client";

export function EmailVerification({ tokenFromUrl, onVerificationComplete }) {
  const [token, setToken] = useState(tokenFromUrl || "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const handleVerify = async (tokenToUse) => {
    const activeToken = tokenToUse || token;
    if (!activeToken) return;

    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const { data, error: apiError } = await authClient.verifyEmail({
        query: {
          token: activeToken,
        },
      });

      if (apiError) throw new Error(apiError.message);

      setStatus("Email verified successfully! You may now sign in.");
      if (onVerificationComplete) onVerificationComplete(data);
    } catch (err) {
      setError(err.message || "Email verification failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenFromUrl) {
      handleVerify(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  return (
    <div className="auth-card">
      <h3>Email Verification</h3>
      {error && <div className="error-alert">{error}</div>}
      {status && <div className="status-notice">{status}</div>}

      {!tokenFromUrl && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify();
          }}
        >
          <div className="form-group">
            <label>Verification Token (from server console log)</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste verification token"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Verify Email"}
          </button>
        </form>
      )}
    </div>
  );
}
