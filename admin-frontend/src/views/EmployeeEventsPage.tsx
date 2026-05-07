import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthedApi } from "../lib/api";
import { useAuth } from "../state/auth";
import "../App.css"

type EmployeeAssignment = {
  employee?: { email?: string };
};

type EmployeeEvent = {
  _id: string;
  activityName?: string;
  budget?: number;
  teamLeader?: { name?: string; email?: string } | null;
  director?: { name?: string; email?: string } | null;
  employeeAssignments?: EmployeeAssignment[];
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n);
}

export function EmployeeEventsPage() {
  const api = useAuthedApi();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["user", "employee", "events"],
    queryFn: async () => (await api.get("/user/employee/events")).data
  });

  const events = (data?.events ?? []) as EmployeeEvent[];
  const myEmail = String(user?.email ?? "").toLowerCase();

  return (
    <div className="pageWrap">

      {/* HEADER */}
      <div className="pageTitle">
        <h1>My Running Events</h1>
      </div>

      <p className="muted" style={{ marginBottom: 18, maxWidth: 650 }}>
        Approved active events where you are assigned. Managed by your Team Leader, overseen by Director.
      </p>

      {/* LIST */}
      <div className="eventGrid">
        {isLoading && <div className="muted">Loading…</div>}

        {events.map((e) => {
          const tl = e.teamLeader;
          const dir = e.director;
          const assigned = e.employeeAssignments?.some(
            (a) => String(a.employee?.email ?? "").toLowerCase() === myEmail
          );

          return (
            <div key={e._id} className="eventCard">

              {/* TOP */}
              <div className="eventHeader">
                <div>
                  <h3>{e.activityName}</h3>
                  <p className="muted">
                    Budget: {formatINR(Number(e.budget ?? 0))}
                  </p>
                </div>

                {assigned && <span className="badgeGlow">Assigned</span>}
              </div>

              {/* INFO ROW */}
              <div className="infoGrid">

                <div className="infoBox">
                  <span className="label">Team Leader</span>
                  <span className="value">{tl?.name || "—"}</span>
                  <span className="sub">{tl?.email}</span>
                </div>

                <div className="infoBox">
                  <span className="label">Director</span>
                  <span className="value">{dir?.name || "—"}</span>
                  <span className="sub">{dir?.email}</span>
                </div>

              </div>

              {/* ACTIONS */}
              <div className="actions">
                <button
                  className="btnPrimary"
                  onClick={() =>
                    navigate(`/employee/bills?eventId=${e._id}&action=create`)
                  }
                >
                  Create Bill
                </button>

                <button
                  className="btnGhost"
                  onClick={() =>
                    navigate(`/employee/bills?eventId=${e._id}&action=view`)
                  }
                >
                  View Bills
                </button>
              </div>

            </div>
          );
        })}

        {!isLoading && events.length === 0 && (
          <div className="muted">No running events assigned to you.</div>
        )}
      </div>
    </div>
  );
}