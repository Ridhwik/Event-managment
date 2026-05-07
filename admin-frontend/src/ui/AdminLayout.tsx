import { useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../state/auth";
import "../App.css";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: "🏠", badge: null },
  { to: "/admin/events", label: "Events", icon: "📅", badge: "12" },
  { to: "/admin/bills", label: "Bills", icon: "🧾", badge: "3" },
  { to: "/admin/vendors", label: "Vendors", icon: "🏪", badge: null },
  { to: "/admin/payment-requests", label: "Payments", icon: "💰", badge: "5" },
  { to: "/admin/team", label: "Team", icon: "👥", badge: null },
  { to: "/admin/closing-sheets", label: "Closing", icon: "📊", badge: null },
  { to: "/admin/accounts", label: "Accounts", icon: "🏦", badge: null },
  { to: "/admin/permissions", label: "Permissions", icon: "🔐", badge: null },
];

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/bills": "Bills",
  "/vendors": "Vendors",
  "/admin/payment-requests": "Payments",
  "/admin/team": "Team",
  "/admin/closing-sheets": "Closing Sheets",
  "/admin/accounts": "Accounts",
  "/admin/permissions": "Permissions",
};

export function AdminLayout() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* live clock */
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* mini particle canvas for topbar */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const dots = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach((d) => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(167,139,250,${d.o})`;
        ctx.fill();
        d.x += d.dx; d.y += d.dy;
        if (d.x < 0 || d.x > canvas.width) d.dx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.dy *= -1;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const pageTitle =
    Object.entries(pageTitles)
      .reverse()
      .find(([p]) => location.pathname.startsWith(p))?.[1] ?? "Admin";

  const initials = admin?.name ? admin.name.slice(0, 2).toUpperCase() : "AD";

  const fmt = (n: number) => n.toString().padStart(2, "0");
  const clockStr = `${fmt(time.getHours())}:${fmt(time.getMinutes())}:${fmt(time.getSeconds())}`;
  const dateStr = time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className={`al-root ${collapsed ? "al--col" : ""}`}>

      {/* overlay */}
      {mobileOpen && <div className="al-overlay" onClick={() => setMobileOpen(false)} />}

      {/* ══════════ SIDEBAR ══════════ */}
      <aside className={`al-sidebar ${mobileOpen ? "al-sidebar--open" : ""}`}>

        {/* top glow bar */}
        <div className="al-sidebar__glow-bar" />

        {/* Brand */}
        <div className="al-brand">
          <Link to="/" className="al-brand__link">
            <div className="al-brand__icon">
              <span>⚡</span>
              <div className="al-brand__icon-ring" />
            </div>
            {!collapsed && (
              <div className="al-brand__text">
                <span className="al-brand__name">EventCo</span>
                <span className="al-brand__sub">Admin Portal</span>
              </div>
            )}
          </Link>
          <button className="al-collapse-btn" onClick={() => setCollapsed(v => !v)}>
            <span className={`al-collapse-btn__arrow ${collapsed ? "al-collapse-btn__arrow--right" : ""}`}>‹</span>
          </button>
        </div>

        {/* User card */}
        {!collapsed && (
          <div className="al-user-card">
            <div className="al-user-card__avatar">
              {initials}
              <span className="al-user-card__online" />
            </div>
            <div className="al-user-card__info">
              <span className="al-user-card__name">{admin?.name ?? "Admin"}</span>
              <span className="al-user-card__role">
                <span className="al-user-card__dot" />
                {admin?.role ?? "admin"}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="al-nav">
          {!collapsed && <span className="al-nav__label-section">MAIN MENU</span>}
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className={({ isActive }) =>
                `al-nav__item ${isActive ? "al-nav__item--active" : ""}`
              }
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
            >
              {({ isActive }) => (
                <>
                  {isActive && <div className="al-nav__active-bg" />}
                  <span className="al-nav__icon-wrap">
                    <span className="al-nav__icon">{item.icon}</span>
                  </span>
                  {!collapsed && <span className="al-nav__text">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className="al-nav__badge">{item.badge}</span>
                  )}
                  {isActive && <span className="al-nav__bar" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Clock */}
        {!collapsed && (
          <div className="al-clock">
            <div className="al-clock__time">{clockStr}</div>
            <div className="al-clock__date">{dateStr}</div>
          </div>
        )}

        {/* Logout */}
        <div className="al-sidebar__foot">
          <button className="al-logout" onClick={logout}>
            <span className="al-logout__icon">🚪</span>
            {!collapsed && <span className="al-logout__text">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ══════════ BODY ══════════ */}
      <div className="al-body">

        {/* Topbar */}
        <header className="al-topbar">
          <canvas ref={canvasRef} className="al-topbar__canvas" />

          <button className="al-hamburger" onClick={() => setMobileOpen(v => !v)}>
            <span /><span /><span />
          </button>

          <div className="al-topbar__left">
            <div className="al-topbar__crumb">
              <span>EventCo</span>
              <span className="al-topbar__crumb-sep">›</span>
              <span className="al-topbar__crumb-active">{pageTitle}</span>
            </div>
            <h1 className="al-topbar__title">{pageTitle}</h1>
          </div>

          <div className="al-topbar__right">
            {/* Search */}
            <div className="al-search">
              <span className="al-search__ico">🔍</span>
              <input className="al-search__inp" placeholder="Search anything…" />
              <span className="al-search__kbd">⌘K</span>
            </div>

            {/* Notif */}
            <button className="al-topbar__btn">
              🔔
              <span className="al-topbar__btn-dot" />
            </button>

            {/* Settings */}
            <button className="al-topbar__btn">⚙️</button>

            {/* Divider */}
            <div className="al-topbar__divider" />

            {/* Avatar */}
            <div className="al-topbar__user">
              <div className="al-topbar__avatar">
                {initials}
                <span className="al-topbar__avatar-ring" />
              </div>
              {<span className="al-topbar__uname">{admin?.name ?? "Admin"}</span>}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="al-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}