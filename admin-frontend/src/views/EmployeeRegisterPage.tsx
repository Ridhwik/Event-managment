import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css"
export function EmployeeRegisterPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
        role: "employee"
      });
      nav("/employee/login", { replace: true, state: { registered: true } });
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
            Join as <span>Employee</span>
          </h1>
          <p>
            Create your account to upload bills, submit vouchers, and track approvals.
          </p>
  
          <div className="roleBadge employee">
            Employee Access
          </div>
        </div>
  
        {/* RIGHT SIDE */}
        <div className="authCard">
          <div className="authHeader">
            <h2>Employee Register</h2>
            <p>Create your employee account</p>
          </div>
  
          <form onSubmit={onSubmit} className="authForm">
  
            <div className="formGroup">
              <label>Full name</label>
              <input
                className="inputModern"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
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
              You must be assigned to an event by your team leader before submitting bills.
            </div>
  
            {error && <div className="errorBox">{error}</div>}
  
            <button className="btnModern employeeBtn" disabled={loading} type="submit">
              {loading ? "Creating account..." : "Create account"}
            </button>
  
            <div className="authLinks">
              <Link to="/">← Back</Link>
              <Link to="/employee/login">Login</Link>
            </div>
  
          </form>
        </div>
      </div>
    </div>
  );
}
