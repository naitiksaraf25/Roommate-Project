import { useState } from "react";
import { authClient } from "../lib/auth-client";

export function Signup({ onSignupSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: apiError } = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: "http://localhost:5173",
      });

      if (apiError) {
        throw new Error(apiError.message || "Signup failed");
      }

      setSubmitted(true);
      if (onSignupSuccess) onSignupSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-card">
        <h3>Signup Successful!</h3>
        <p className="status-notice">
          A verification link has been generated for <strong>{email}</strong>.
        </p>
        <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
          (In local development mode, check your server terminal console for the printed verification link & token).
        </p>
        <button onClick={() => setSubmitted(false)}>Back to Form</button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h3>Create RoomieMatch Account</h3>
      {error && <div className="error-alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
          />
        </div>
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
          {loading ? "Creating Account..." : "Sign Up with Email"}
        </button>
      </form>
    </div>
  );
}
