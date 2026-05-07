import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css"
export function StaffRegisterPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<"director" | "teamLeader">("teamLeader");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await axios.post("/api/user/register", {
        name,
        email,
        password,
        role
      });
      nav("/staff/login", { replace: true, state: { registered: true } });
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
          "string"
          ? (err as { response: { data: { message: string } } }).response.data.message
          : "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authContainer">
  
        {/* LEFT SIDE */}
        <div className="authLeft">
          <h1>
            Create Staff <span>Account</span>
          </h1>
          <p>
            Register as a Director or Team Leader to manage events and coordinate teams.
          </p>
  
          <div className="roleBadge staff">
            Staff Access
          </div>
        </div>
  
        {/* RIGHT SIDE */}
        <div className="authCard">
          <div className="authHeader">
            <h2>Staff Register</h2>
            <p>Create your staff account</p>
          </div>
  
          <form onSubmit={onSubmit} className="authForm">
  
            <div className="formGroup">
              <label>Full name</label>
              <input
                className="inputModern"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
  
            <div className="formGroup">
              <label>Email</label>
              <input
                className="inputModern"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
  
            <div className="formGroup">
              <label>Role</label>
              <select
                className="inputModern"
                value={role}
                onChange={(e) => setRole(e.target.value as "director" | "teamLeader")}
              >
                <option value="teamLeader">Team Leader</option>
                <option value="director">Director</option>
              </select>
            </div>
  
            <div className="formGroup">
              <label>Password</label>
              <input
                className="inputModern"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
  
            <div className="formGroup">
              <label>Confirm password</label>
              <input
                className="inputModern"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                required
              />
            </div>
  
            <div className="infoBox">
              Directors can create events. Team Leaders manage assigned teams and employees.
            </div>
  
            {error && <div className="errorBox">{error}</div>}
  
            <button className="btnModern staffBtn" disabled={loading} type="submit">
              {loading ? "Creating account..." : "Create account"}
            </button>
  
            <div className="authLinks">
              <Link to="/">← Back</Link>
              <Link to="/staff/login">Login</Link>
            </div>
  
          </form>
        </div>
      </div>
    </div>
  );
}
