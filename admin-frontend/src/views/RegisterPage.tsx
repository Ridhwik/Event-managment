import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";

export function RegisterPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── particle canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      o: Math.random() * 0.5 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,140,255,${p.o})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dist = Math.hypot(
            particles[i].x - particles[j].x,
            particles[i].y - particles[j].y
          );
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(160,100,255,${0.12 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* mount animation */
  useEffect(() => {
    const t = setTimeout(() => setStep(1), 80);
    return () => clearTimeout(t);
  }, []);

  /* password strength */
  const strength =
    !password.length ? 0
      : password.length < 6 ? 1
        : password.length < 10 ? 2
          : /[^a-zA-Z0-9]/.test(password) ? 4
            : 3;
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#f87171", "#fbbf24", "#34d399", "#10b981"][strength];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setLoading(true);
    try {
      await axios.post("/api/admin/register", { name, email, password });
      nav("/login", { replace: true, state: { registered: true } });
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response: { data: { message: string } } }).response.data.message
          : "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rp-root">
      <canvas ref={canvasRef} className="rp-canvas" />

      {/* Orbs */}
      <div className="rp-orb rp-orb--1" />
      <div className="rp-orb rp-orb--2" />
      <div className="rp-orb rp-orb--3" />
      <div className="rp-orb rp-orb--4" />

      <div className={`rp-shell ${step ? "rp-shell--in" : ""}`}>

        {/* ══ LEFT ══ */}
        <div className="rp-left">
          <div className="rp-left__top">
            <div className="rp-logo">
              <div className="rp-logo__icon">⚡</div>
              <span className="rp-logo__name">EventCo</span>
            </div>
          </div>

          <div className="rp-left__mid">
            <div className="rp-left__tag">✦ Trusted by 10,000+ organisers</div>
            <h1 className="rp-left__headline">
              Your events,<br />
              <span className="rp-gradient-text">supercharged.</span>
            </h1>
            <p className="rp-left__body">
              Plan, manage, and grow — all from one beautiful dashboard.
            </p>
            <div className="rp-pills">
              {[
                "🗓  Smart Scheduling",
                "👥  Team Workspaces",
                "📊  Live Analytics",
                "🔔  Instant Alerts",
              ].map((t) => (
                <span className="rp-pill" key={t}>{t}</span>
              ))}
            </div>
          </div>

          <div className="rp-left__testimonial">
            <div className="rp-testi">
              <p className="rp-testi__quote">
                "EventCo cut our planning time by 60%. Absolute game changer."
              </p>
              <div className="rp-testi__author">
                <div className="rp-testi__avatar">SK</div>
                <div>
                  <div className="rp-testi__name">Sarah K.</div>
                  <div className="rp-testi__role">Head of Events, Pulse Agency</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT ══ */}
        <div className="rp-card">
          <div className="rp-card__glow-bar" />

          <div className="rp-card__inner">

            <div className="rp-card__head">
              <span className="rp-chip">Admin Account</span>
              <h2 className="rp-card__title">Create account</h2>
              <p className="rp-card__sub">Join thousands of event professionals</p>
            </div>

            <form onSubmit={onSubmit} className="rp-form" noValidate>

              {/* Row: name + email */}
              <div className="rp-row">
                <Field
                  label="Full name" icon="👤" id="rp-name"
                  value={name} onChange={setName}
                  placeholder="John Doe"
                  focused={focused}
                  onFocus={() => setFocused("rp-name")}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  label="Email" icon="✉️" id="rp-email"
                  type="email" value={email} onChange={setEmail}
                  placeholder="john@company.com"
                  focused={focused}
                  onFocus={() => setFocused("rp-email")}
                  onBlur={() => setFocused(null)}
                />
              </div>

              {/* Password */}
              <div className="rp-field">
                <div className="rp-label-row">
                  <label className="rp-label">Password</label>
                  {password.length > 0 && (
                    <span className="rp-strength-tag" style={{ color: strengthColor }}>
                      {strengthLabel}
                    </span>
                  )}
                </div>
                <div className={`rp-input-wrap ${focused === "pass" ? "rp-input-wrap--focus" : ""}`}>
                  <span className="rp-ico">🔒</span>
                  <input
                    className="rp-input"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    onFocus={() => setFocused("pass")}
                    onBlur={() => setFocused(null)}
                    required
                  />
                  <button
                    type="button"
                    className="rp-toggle"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="rp-bar-track">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="rp-bar-seg"
                        style={{
                          background: i <= strength ? strengthColor : "rgba(255,255,255,0.1)",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div className="rp-field">
                <label className="rp-label">Confirm password</label>
                <div
                  className={`rp-input-wrap
                    ${focused === "conf" ? "rp-input-wrap--focus" : ""}
                    ${confirm && confirm === password ? "rp-input-wrap--ok" : ""}
                    ${confirm && confirm !== password ? "rp-input-wrap--err" : ""}
                  `}
                >
                  <span className="rp-ico">🔒</span>
                  <input
                    className="rp-input"
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    onFocus={() => setFocused("conf")}
                    onBlur={() => setFocused(null)}
                    required
                  />
                  <button
                    type="button"
                    className="rp-toggle"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? "🙈" : "👁️"}
                  </button>
                  {confirm && (
                    <span className="rp-match">
                      {confirm === password ? "✅" : "❌"}
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <div className="rp-error">
                  <span className="rp-error__icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button className="rp-submit" disabled={loading} type="submit">
                {loading ? (
                  <><span className="rp-spin" /> Creating your account…</>
                ) : (
                  <><span>Create account</span><span className="rp-submit__arrow">→</span></>
                )}
              </button>

              <p className="rp-terms">
                By signing up you agree to our{" "}
                <a href="#">Terms</a> &amp; <a href="#">Privacy Policy</a>
              </p>

            </form>

            <div className="rp-foot">
              <Link to="/" className="rp-foot__back">← Back</Link>
              <span className="rp-foot__sep" />
              <span className="rp-foot__text">Have an account?</span>
              <Link to="/login" className="rp-foot__signin">Sign in</Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── reusable field ── */
function Field({
  label, icon, id, type = "text", value, onChange,
  placeholder, focused, onFocus, onBlur,
}: {
  label: string; icon: string; id: string; type?: string;
  value: string; onChange: (v: string) => void; placeholder: string;
  focused: string | null; onFocus: () => void; onBlur: () => void;
}) {
  return (
    <div className="rp-field">
      <label className="rp-label" htmlFor={id}>{label}</label>
      <div className={`rp-input-wrap ${focused === id ? "rp-input-wrap--focus" : ""}`}>
        <span className="rp-ico">{icon}</span>
        <input
          id={id}
          className="rp-input"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={onFocus}
          onBlur={onBlur}
          required
        />
      </div>
    </div>
  );
}