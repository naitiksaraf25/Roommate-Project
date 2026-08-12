import { useState } from "react";
import { authClient } from "../lib/auth-client";

export function Login({ onLoginSuccess, onToggleForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: apiError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "http://localhost:5173",
      });

      if (apiError) {
        throw new Error(apiError.message || "Login failed");
      }

      if (onLoginSuccess) onLoginSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "http://localhost:5173",
      });
    } catch (err) {
      setError("Google Sign-In initialization failed: " + err.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h3>Sign In to RoomieMatch</h3>
      {error && <div className="error-alert">{error}</div>}

      <form onSubmit={handleEmailLogin}>
        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Signing In..." : "Sign In with Email"}
        </button>
      </form>

      <div style={{ margin: "1rem 0", display: "flex", justifyContent: "space-between" }}>
        <button
          type="button"
          className="btn-link"
          onClick={onToggleForgotPassword}
        >
          Forgot Password?
        </button>
      </div>

      <div className="divider">OR</div>

      <button
        type="button"
        className="btn-google"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
      >
        {googleLoading ? "Connecting to Google..." : "Continue with Google"}
      </button>
    </div>
  );
}
