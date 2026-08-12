import { useState } from "react";
import { authClient } from "../lib/auth-client";

export function ForgotPassword({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState("request"); // 'request' | 'reset'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: apiError } = await authClient.forgetPassword({
        email,
        redirectTo: "http://localhost:5173",
      });

      if (apiError) throw new Error(apiError.message);

      setMessage("Password reset token generated! (Check server console log in dev mode).");
      setStep("reset");
    } catch (err) {
      setError(err.message || "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: apiError } = await authClient.resetPassword({
        newPassword,
        token: resetToken,
      });

      if (apiError) throw new Error(apiError.message);

      setMessage("Password reset successful! You can now log in with your new password.");
      setStep("done");
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h3>Password Reset Flow</h3>
      {error && <div className="error-alert">{error}</div>}
      {message && <div className="status-notice">{message}</div>}

      {step === "request" && (
        <form onSubmit={handleRequestReset}>
          <div className="form-group">
            <label>Registered Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Request Reset Token"}
          </button>
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={handleResetConfirm}>
          <div className="form-group">
            <label>Reset Token (copied from server dev console)</label>
            <input
              type="text"
              required
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Paste token here"
            />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Confirm Password Reset"}
          </button>
        </form>
      )}

      <div style={{ marginTop: "1rem" }}>
        <button type="button" className="btn-link" onClick={onBackToLogin}>
          Back to Login
        </button>
      </div>
    </div>
  );
}
