import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";
import { api } from "../lib/api";

export function ResetPasswordPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.resetPassword(token, password);
      await signIn(response.user.email, password);
      navigate("/products");
    } catch (submissionError) {
      const nextError =
        submissionError instanceof Error ? submissionError.message : "Reset failed.";
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card form-card" onSubmit={onSubmit}>
        <h2>Reset Password</h2>
        <label>
          Reset Token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            minLength={32}
            required
          />
        </label>
        <label>
          New Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            minLength={8}
            required
          />
        </label>
        <label>
          Confirm Password
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            minLength={8}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
        <p className="hint">
          Need a token? <Link to="/forgot-password">Forgot password</Link>
        </p>
      </form>
    </div>
  );
}
