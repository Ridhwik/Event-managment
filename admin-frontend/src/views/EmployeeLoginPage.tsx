import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../state/auth";
import type { StaffProfile } from "../state/auth";
import "../App.css"

export function EmployeeLoginPage() {
  const { setAuthEmployee } = useAuth();
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
      if (u.role !== "employee") {
        setError("Use this page for employee accounts only. Directors and team leaders use Staff login.");
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
        role: "employee"
      };
      setAuthEmployee(res.data.token, profile);
      nav("/employee", { replace: true });
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
  
        {/* LEFT SIDE (ROLE DIFFERENTIATION) */}
        <div className="authLeft">
          <h1>
            Employee Access <span>Portal</span>
          </h1>
          <p>
            Submit bills, upload vouchers, and track approvals for your assigned events.
          </p>
  
          <div className="roleBadge">
            Employee Panel
          </div>
        </div>
  
        {/* RIGHT SIDE */}
        <div className="authCard">
          <div className="authHeader">
            <h2>Employee Login</h2>
            <p>Sign in to continue</p>
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
  
            {error && (
              <div className="errorBox">{error}</div>
            )}
  
            <button className="btnModern" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
  
            <div className="authLinks">
              <Link to="/">← Back</Link>
              <Link to="/employee/register">Register</Link>
            </div>
  
            <div className="switchRole">
              Redirect to <Link to="/staff/login">Staff login</Link>
            </div>
  
          </form>
        </div>
      </div>
    </div>
  );
}
