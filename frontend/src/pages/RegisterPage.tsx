import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/auth-context";

export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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
      await signUp(email, password);
      navigate("/products");
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card form-card" onSubmit={onSubmit}>
        <h2>Register</h2>
        <label>
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
          />
        </label>
        <label>
          Password
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
          {loading ? "Creating account..." : "Create account"}
        </button>
        <p className="hint">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

