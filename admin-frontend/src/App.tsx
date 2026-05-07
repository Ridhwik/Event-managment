import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/auth";
import { AdminLayout } from "./ui/AdminLayout";
import { StaffLayout } from "./ui/StaffLayout";
import { EmployeeLayout } from "./ui/EmployeeLayout";
import { LandingPage } from "./views/LandingPage";
import { LoginPage } from "./views/LoginPage";
import { RegisterPage } from "./views/RegisterPage";
import { StaffLoginPage } from "./views/StaffLoginPage";
import { StaffRegisterPage } from "./views/StaffRegisterPage";
import { EmployeeLoginPage } from "./views/EmployeeLoginPage";
import { EmployeeRegisterPage } from "./views/EmployeeRegisterPage";
import { DashboardPage } from "./views/DashboardPage";
import { EventsPage } from "./views/EventsPage";
import { BillsPage } from "./views/BillsPage";
import { PaymentRequestsPage } from "./views/PaymentRequestsPage";
import { TeamPage } from "./views/TeamPage";
import { ClosingSheetsPage } from "./views/ClosingSheetsPage";
import { AccountsPage } from "./views/AccountsPage";
import { PermissionsPage } from "./views/PermissionsPage";
import { StaffDashboardPage } from "./views/StaffDashboardPage";
import { StaffEventsPage } from "./views/StaffEventsPage";
import { StaffCreateEventPage } from "./views/StaffCreateEventPage";
import { EmployeeDashboardPage } from "./views/EmployeeDashboardPage";
import { EmployeeEventsPage } from "./views/EmployeeEventsPage";
import { EmployeeBillsPage } from "./views/EmployeeBillsPage";
import { EmployeePaymentRequestsPage } from "./views/EmployeePaymentRequestsPage";
import VendorsPage from "./views/VendorsPage.tsx";
import ViewBillPage from "./views/ViewBillPage";

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { token, authKind } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (authKind === "staff") return <Navigate to="/staff" replace />;
  if (authKind === "employee") return <Navigate to="/employee" replace />;
  if (authKind !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { token, authKind } = useAuth();
  if (!token) return <Navigate to="/staff/login" replace />;
  if (authKind === "employee") return <Navigate to="/employee" replace />;
  if (authKind !== "staff") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function RequireEmployee({ children }: { children: React.ReactNode }) {
  const { token, authKind } = useAuth();
  if (!token) return <Navigate to="/employee/login" replace />;
  if (authKind === "staff") return <Navigate to="/staff" replace />;
  if (authKind === "admin") return <Navigate to="/admin" replace />;
  if (authKind !== "employee") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireAdminOrStaff({ children }: { children: React.ReactNode }) {
  const { token, authKind } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (authKind === "employee") return <Navigate to="/employee" replace />;
  if (authKind !== "admin" && authKind !== "staff") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeGate() {
  const { token, authKind } = useAuth();
  if (token && authKind === "admin") return <Navigate to="/admin" replace />;
  if (token && authKind === "staff") return <Navigate to="/staff" replace />;
  if (token && authKind === "employee") return <Navigate to="/employee" replace />;
  return <LandingPage />;
}

function portalHome(authKind: ReturnType<typeof useAuth>["authKind"]) {
  if (authKind === "staff") return "/staff";
  if (authKind === "employee") return "/employee";
  if (authKind === "admin") return "/admin";
  return "/";
}

export default function App() {
  const { token, authKind } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomeGate />} />

      {/* Admin auth */}
      <Route
        path="/login"
        element={
          token && authKind === "admin" ? (
            <Navigate to="/admin" replace />
          ) : token && authKind === "staff" ? (
            <Navigate to="/staff" replace />
          ) : token && authKind === "employee" ? (
            <Navigate to="/employee" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/register"
        element={
          token ? <Navigate to={portalHome(authKind)} replace /> : <RegisterPage />
        }
      />
      <Route path="/vendors" element={<VendorsPage />} />
      <Route
        path="/view-bill/:eventId"
        element={
          <RequireAdminOrStaff>
            <ViewBillPage />
          </RequireAdminOrStaff>
        }
      />

      {/* Staff auth */}
      <Route
        path="/staff/login"
        element={
          token && authKind === "staff" ? (
            <Navigate to="/staff" replace />
          ) : token && authKind === "admin" ? (
            <Navigate to="/admin" replace />
          ) : token && authKind === "employee" ? (
            <Navigate to="/employee" replace />
          ) : (
            <StaffLoginPage />
          )
        }
      />
      <Route
        path="/staff/register"
        element={
          token ? <Navigate to={portalHome(authKind)} replace /> : <StaffRegisterPage />
        }
      />


      {/* Employee auth */}
      <Route
        path="/employee/login"
        element={
          token && authKind === "employee" ? (
            <Navigate to="/employee" replace />
          ) : token && authKind === "admin" ? (
            <Navigate to="/admin" replace />
          ) : token && authKind === "staff" ? (
            <Navigate to="/staff" replace />
          ) : (
            <EmployeeLoginPage />
          )
        }
      />
      <Route
        path="/employee/register"
        element={
          token ? <Navigate to={portalHome(authKind)} replace /> : <EmployeeRegisterPage />
        }
      />

      {/* Admin app */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="bills" element={<BillsPage />} />
        <Route path="payment-requests" element={<PaymentRequestsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="closing-sheets" element={<ClosingSheetsPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="vendors" element={<VendorsPage />} />
      </Route>

      {/* Staff app (Director / Team Leader) */}
      <Route
        path="/staff"
        element={
          <RequireStaff>
            <StaffLayout />
          </RequireStaff>
        }
      >
        <Route index element={<StaffDashboardPage />} />
        <Route path="events" element={<StaffEventsPage />} />
        <Route path="create-event" element={<StaffCreateEventPage />} />
      </Route>

      {/* Employee app */}
      <Route
        path="/employee"
        element={
          <RequireEmployee>
            <EmployeeLayout />
          </RequireEmployee>
        }
      >
        <Route index element={<EmployeeDashboardPage />} />
        <Route path="events" element={<EmployeeEventsPage />} />
        <Route path="bills" element={<EmployeeBillsPage />} />
        <Route path="payment-requests" element={<EmployeePaymentRequestsPage />} />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={
              !token
                ? "/"
                : authKind === "staff"
                  ? "/staff"
                  : authKind === "admin"
                    ? "/admin"
                    : authKind === "employee"
                      ? "/employee"
                      : "/"
            }
            replace
          />
        }
      />
    </Routes>

  );
}
