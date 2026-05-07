import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthedApi } from "../lib/api";
import "../App.css"

type EmployeeDashboardRow = {
  eventId: string;
  activityName?: string;
  accountNumber?: string;
  startDate?: string;
  closingDate?: string;
};

type EmployeeEventRow = {
  _id: string;
  activityName?: string;
  startDate?: string;
  closingDate?: string;
};

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function EmployeeDashboardPage() {
  const api = useAuthedApi();

  const { data } = useQuery({
    queryKey: ["employee-dashboard"],
    queryFn: async () => (await api.get("/user/employee/dashboard")).data
  });

  const { data: allEventsData } = useQuery({
    queryKey: ["employee-events"],
    queryFn: async () => (await api.get("/user/employee/events/all")).data
  });

  const rows = data?.runningAssignments ?? [];
  const allEvents = useMemo(() => allEventsData?.events ?? [], [allEventsData]);

  return (
    <div className="layout">


      {/* MAIN */}
      <main className="main">

        {/* HEADER */}
        <div className="header">
          <h1>Dashboard</h1>
          <p>Welcome back 👋 Track your assigned work</p>
        </div>

        {/* TOP STATS */}
        <div className="statsRow">
          <Stat title="Running" value={data?.runningEventsCount} />
          <Stat title="Assigned" value={data?.assignedEvents} />
          <Stat title="Bills Pending" value={data?.billsPendingReview} />
          <Stat title="Payments" value={data?.paymentRequestsPending} />
        </div>

        {/* EVENTS TABLE STYLE */}
        <section className="panel">
          <h3>All Events</h3>

          <div className="list">
            {allEvents.map((ev: any) => (
              <div className="row" key={ev._id}>
                <div>
                  <strong>{ev.activityName}</strong>
                  <div className="muted">
                    {formatDate(ev.startDate)} → {formatDate(ev.closingDate)}
                  </div>
                </div>
                <span className="badge">Active</span>
              </div>
            ))}
          </div>
        </section>

        {/* ASSIGNMENTS */}
       {/* ASSIGNED EVENTS */}
<section className="panel">
  <h3>Assigned Events</h3>

  <div className="list">
    {rows.map((r: any) => (
      <div className="row" key={r.eventId}>

        <div>
          <strong>{r.activityName}</strong>

          <div className="muted">
            Account: {r.accountNumber || "—"} <br />
            Start: {formatDate(r.startDate)} → End: {formatDate(r.closingDate)}
          </div>

          {/* 👇 DIRECTOR + TEAM LEADER */}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
            <div>
              👨‍💼 Director:{" "}
              <span style={{ color: "#a855f7" }}>
                {r.director?.name || r.director?.email || "—"}
              </span>
            </div>

            <div>
              👥 Team Leader:{" "}
              <span style={{ color: "#06b6d4" }}>
                {r.teamLeader?.name || r.teamLeader?.email || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* STATUS BADGE */}
        <span className="tag">Assigned</span>
      </div>
    ))}
  </div>

  {rows.length === 0 && (
    <div className="muted">No assigned events found</div>
  )}
</section>
      </main>
    </div>
  );
}

/* Small component */
function Stat({ title, value }: { title: string; value: any }) {
  return (
    <div className="statCard">
      <div className="muted">{title}</div>
      <div className="statValue">{value ?? 0}</div>
    </div>
  );
}