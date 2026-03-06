import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setResetToken(null);

    try {
      const response = await api.forgotPassword(email);
      setMessage(response.message);
      setResetToken(response.resetToken ?? null);
    } catch (submissionError) {
      const nextError =
        submissionError instanceof Error
          ? submissionError.message
          : "Password reset request failed.";
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card form-card" onSubmit={onSubmit}>
        <h2>Forgot Password</h2>
        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="hint">{message}</p> : null}
        {resetToken ? (
          <p className="hint">Development reset token: {resetToken}</p>
        ) : null}
        <button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Send reset token"}
        </button>
        <p className="hint">
          Already have token? <Link to="/reset-password">Reset password</Link>
        </p>
        <p className="hint">
          Back to <Link to="/login">login</Link>
        </p>
      </form>
    </div>
  );
}
