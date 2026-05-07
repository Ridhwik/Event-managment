import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../state/auth";
import "../App.css";

const nav = [
  { to: "/employee", label: "Dashboard", icon: "🏠" },
  { to: "/employee/events", label: "My Events", icon: "📅" },
  { to: "/employee/bills", label: "Bills", icon: "🧾" },
  { to: "/employee/payment-requests", label: "Requests", icon: "💰" }
];

export function EmployeeLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="appShell">

      {/* SIDEBAR */}
      <aside className="sidebar employeeTheme">
        <div className="brand">
          <div className="brandMark blue">EC</div>
          <div>
            <div className="brandName">EventCo</div>
            <div className="brandSub">Employee Portal</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === "/employee"}
              className={({ isActive }) =>
                `navItem ${isActive ? "active blueActive" : ""}`
              }
            >
              <span className="navIcon">{i.icon}</span>
              {i.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebarFooter">
          <div className="who">
            <div className="whoAvatar blue">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "EM"}
            </div>
            <div>
              <div className="whoName">{user?.name ?? "Employee"}</div>
              <div className="whoRole">EMPLOYEE</div>
            </div>
          </div>

          <button className="logoutBtn blueBtn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="mainWrapper">

        {/* TOPBAR */}
        <header className="topbar">
          <div className="topTitle">Employee Dashboard</div>

          <div className="topUser">
            <div className="whoAvatar small blue">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : "EM"}
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