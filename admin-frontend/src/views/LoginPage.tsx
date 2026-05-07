import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../state/auth";
import "../App.css";

export function LoginPage() {
  const { setAuthAdmin } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const registered = Boolean(
    (location.state as { registered?: boolean } | null)?.registered
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post("/api/admin/login", { email, password });
      setAuthAdmin(res.data.token, res.data.admin);
      nav("/admin", { replace: true });
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response: { data: { message: string } } }).response.data.message
          : "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lp-root">
      <canvas ref={canvasRef} className="lp-canvas" />

      {/* Orbs */}
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />
      <div className="lp-orb lp-orb--3" />
      <div className="lp-orb lp-orb--4" />

      <div className={`lp-shell ${step ? "lp-shell--in" : ""}`}>

        {/* ══ LEFT ══ */}
        <div className="lp-left">
          <div className="lp-logo">
            <div className="lp-logo__icon">⚡</div>
            <span className="lp-logo__name">EventCo</span>
          </div>

          <div className="lp-left__mid">
            <div className="lp-left__tag">✦ Admin Portal</div>
            <h1 className="lp-left__headline">
              Welcome<br />
              <span className="lp-gradient-text">back.</span>
            </h1>
            <p className="lp-left__body">
              Your events, teams, and budgets are waiting. Sign in to pick up where you left off.
            </p>

            <div className="lp-stats">
              {[
                { value: "10K+", label: "Organisers" },
                { value: "50K+", label: "Events run" },
                { value: "99.9%", label: "Uptime" },
              ].map((s) => (
                <div className="lp-stat" key={s.label}>
                  <span className="lp-stat__value">{s.value}</span>
                  <span className="lp-stat__label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-left__testimonial">
            <div className="lp-testi">
              <p className="lp-testi__quote">
                "The best event management platform we've ever used. Saves us hours every week."
              </p>
              <div className="lp-testi__author">
                <div className="lp-testi__avatar">JM</div>
                <div>
                  <div className="lp-testi__name">James M.</div>
                  <div className="lp-testi__role">Operations Lead, NovaCo</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT ══ */}
        <div className="lp-card">
          <div className="lp-card__glow-bar" />

          <div className="lp-card__inner">

            <div className="lp-card__head">
              <span className="lp-chip">Admin Account</span>
              <h2 className="lp-card__title">Sign in</h2>
              <p className="lp-card__sub">Enter your credentials to continue</p>
            </div>

            {/* Success banner */}
            {registered && (
              <div className="lp-success">
                <span className="lp-success__icon">🎉</span>
                <span>Account created successfully! You can now sign in.</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="lp-form" noValidate>

              {/* Email */}
              <div className="lp-field">
                <label className="lp-label" htmlFor="lp-email">Email address</label>
                <div className={`lp-input-wrap ${focused === "email" ? "lp-input-wrap--focus" : ""}`}>
                  <span className="lp-ico">✉️</span>
                  <input
                    id="lp-email"
                    className="lp-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="lp-field">
                <div className="lp-label-row">
                  <label className="lp-label" htmlFor="lp-pass">Password</label>
                  <a href="#" className="lp-forgot">Forgot password?</a>
                </div>
                <div className={`lp-input-wrap ${focused === "pass" ? "lp-input-wrap--focus" : ""}`}>
                  <span className="lp-ico">🔒</span>
                  <input
                    id="lp-pass"
                    className="lp-input"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    onFocus={() => setFocused("pass")}
                    onBlur={() => setFocused(null)}
                    required
                  />
                  <button
                    type="button"
                    className="lp-toggle"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="lp-remember">
                <input type="checkbox" className="lp-checkbox" />
                <span className="lp-checkbox__custom" />
                <span className="lp-remember__text">Remember me for 30 days</span>
              </label>

              {/* Error */}
              {error && (
                <div className="lp-error">
                  <span className="lp-error__icon">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button className="lp-submit" disabled={loading} type="submit">
                {loading ? (
                  <><span className="lp-spin" /> Signing in…</>
                ) : (
                  <><span>Sign in</span><span className="lp-submit__arrow">→</span></>
                )}
              </button>

              <p className="lp-terms">
                Protected by enterprise-grade encryption &amp; security.
              </p>

            </form>

            <div className="lp-foot">
              <Link to="/" className="lp-foot__back">← Back</Link>
              <span className="lp-foot__sep" />
              <span className="lp-foot__text">No account?</span>
              <Link to="/register" className="lp-foot__register">Create one</Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}