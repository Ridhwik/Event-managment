import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../state/auth";
import type { StaffProfile } from "../state/auth";
import "../App.css"
export function StaffLoginPage() {
  const { setAuthStaff } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const registered = Boolean((location.state as { registered?: boolean } | null)?.registered);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post("/api/user/login", { email, password });
      const u = res.data.user as {
        _id?: string;
        id?: string;
        name: string;
        email: string;
        role: string;
      };
      if (u.role === "employee") {
        setError("Employees should use Employee login from the home page.");
        return;
      }
      if (u.role !== "director" && u.role !== "teamLeader") {
        setError("This portal is for Director and Team Leader accounts only.");
        return;
      }
      const uid = String(u._id ?? u.id ?? "");
      if (!uid) {
        setError("Invalid user payload from server.");
        return;
      }
      const profile: StaffProfile = {
        id: uid,
        name: u.name,
        email: u.email,
        role: u.role
      };
      setAuthStaff(res.data.token, profile);
      nav("/staff", { replace: true });
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
          "string"
          ? (err as { response: { data: { message: string } } }).response.data.message
          : "Login failed";
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
            Staff <span>Portal</span>
          </h1>
          <p>
            Manage events, assign employees, and track progress as a Director or Team Leader.
          </p>
  
          <div className="roleBadge staff">
            Director / Team Leader
          </div>
        </div>
  
        {/* RIGHT SIDE */}
        <div className="authCard">
          <div className="authHeader">
            <h2>Staff Login</h2>
            <p>Sign in to your staff account</p>
          </div>
  
          <form onSubmit={onSubmit} className="authForm">
  
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
              <label>Password</label>
              <input
                className="inputModern"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
  
            {registered && (
              <div className="successBox">
                Account created. You can now log in.
              </div>
            )}
  
            {error && <div className="errorBox">{error}</div>}
  
            <button className="btnModern staffBtn" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
  
            <div className="authLinks">
              <Link to="/">← Back</Link>
              <Link to="/staff/register">Register</Link>
            </div>
  
            <div className="switchRole">
              Admin? <Link to="/login">Admin login</Link>
            </div>
  
          </form>
        </div>
      </div>
    </div>
  );
}
