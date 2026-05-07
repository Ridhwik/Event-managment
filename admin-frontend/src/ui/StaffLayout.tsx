import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/auth";
import "../App.css"

const nav = [
  { to: "/staff", label: "Dashboard", icon: "🏠" },
  { to: "/staff/events", label: "Running Events", icon: "📅" },
  { to: "/staff/create-event", label: "Create Event", icon: "➕" }
];

export function StaffLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="appShell">

      {/* SIDEBAR */}
      <aside className="sidebar staffTheme">
        <div className="brand">
          <div className="brandMark green">EC</div>
          <div>
            <div className="brandName">EventCo</div>
            <div className="brandSub">Staff Portal</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/staff"}
              className={({ isActive }) =>
                `navItem ${isActive ? "active greenActive" : ""}`
              }
            >
              <span className="navIcon">{i.icon}</span>
              {i.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebarFooter">
          <div className="who">
            <div className="whoAvatar green">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
            </div>
            <div>
              <div className="whoName">{user?.name ?? "Staff"}</div>
              <div className="whoRole">
                {String(user?.role ?? "STAFF").toUpperCase()}
              </div>
            </div>
          </div>

          <button className="logoutBtn greenBtn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="mainWrapper">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="topTitle">Staff Dashboard</div>

          <div className="topUser">
            <div className="whoAvatar small green">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
            </div>
          </div>
        </header>

        <main className="main">
          <Outlet />
        </main>

      </div>
    </div>
  );
}