import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthedApi } from "../lib/api";
import { CreateEventModal } from "./CreateEventModal";
import "../App.css";

type EventType = {
  _id: string;
  activityName?: string;
  lifecycleStatus?: "upcoming" | "active" | "closed";
  accountNumber?: string;
  startDate?: string;
  closingDate?: string;
  endDate?: string | null;
  budget?: number;
  spent?: number;
  teamLeader?: { name?: string };
  director?: { name?: string };
};

function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 0,
    }).format(n);
  } catch { return `₹${n}`; }
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const STATUS_MAP = {
  active: { label: "Active", cls: "ev-badge--active", icon: "🟢" },
  upcoming: { label: "Upcoming", cls: "ev-badge--upcoming", icon: "🔵" },
  closed: { label: "Closed", cls: "ev-badge--closed", icon: "⚫" },
};

export function EventsPage() {
  const api = useAuthedApi();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "upcoming" | "closed">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "events"],
    queryFn: async () => (await api.get("/admin/events")).data,
  });

  const events: EventType[] = data?.events ?? [];

  const filtered = events.filter((e) => {
    const matchSearch = (e.activityName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || e.lifecycleStatus === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: events.length,
    active: events.filter(e => e.lifecycleStatus === "active").length,
    upcoming: events.filter(e => e.lifecycleStatus === "upcoming").length,
    closed: events.filter(e => e.lifecycleStatus === "closed").length,
  };

  return (
    <div className="ev-root">

      {/* ── HEADER ── */}
      <div className="ev-header">
        <div className="ev-header__left">
          <div className="ev-header__tag">📅 Management</div>
          <h1 className="ev-header__title">Events</h1>
          <p className="ev-header__sub">
            Manage, track, and monitor all your events in one place.
          </p>
        </div>
        <button className="ev-create-btn" onClick={() => setCreateOpen(true)}>
          <span className="ev-create-btn__ico">＋</span>
          Create Event
        </button>
      </div>

      {/* ── STAT PILLS ── */}
      <div className="ev-pills">
        {(["all", "active", "upcoming", "closed"] as const).map((f) => (
          <button
            key={f}
            className={`ev-pill ${filter === f ? "ev-pill--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "🗂" : f === "active" ? "🟢" : f === "upcoming" ? "🔵" : "⚫"}
            <span>{f.charAt(0).toUpperCase() + f.slice(1)}</span>
            <span className="ev-pill__count">{counts[f]}</span>
          </button>
        ))}

        {/* Search */}
        <div className="ev-search">
          <span className="ev-search__ico">🔍</span>
          <input
            className="ev-search__inp"
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="ev-search__clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>
      </div>

      <CreateEventModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* ── LOADING ── */}
      {isLoading && (
        <div className="ev-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="ev-card ev-card--skeleton" key={i}>
              <div className="ev-skel ev-skel--title" />
              <div className="ev-skel ev-skel--row" />
              <div className="ev-skel ev-skel--row" />
              <div className="ev-skel ev-skel--bar" />
            </div>
          ))}
        </div>
      )}

      {/* ── GRID ── */}
      {!isLoading && (
        <>
          {filtered.length === 0 ? (
            <div className="ev-empty">
              <div className="ev-empty__ico">🗂️</div>
              <div className="ev-empty__title">No events found</div>
              <div className="ev-empty__sub">Try changing your filter or search term.</div>
            </div>
          ) : (
            <div className="ev-grid">
              {filtered.map((e, idx) => {
                const st = STATUS_MAP[e.lifecycleStatus ?? "upcoming"] ?? STATUS_MAP.upcoming;
                const budget = e.budget ?? 0;
                const spent = e.spent ?? 0;
                const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                const over = spent > budget && budget > 0;
                const initial = (e.activityName ?? "E").charAt(0).toUpperCase();

                return (
                  <div
                    className={`ev-card ev-card--${e.lifecycleStatus ?? "upcoming"}`}
                    key={e._id}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    {/* glow accent */}
                    <div className="ev-card__glow" />

                    {/* top row */}
                    <div className="ev-card__top">
                      <div className="ev-card__avatar">{initial}</div>
                      <div className="ev-card__title-wrap">
                        <h2 className="ev-card__name">{e.activityName ?? "Unnamed Event"}</h2>
                        <div className="ev-card__acc">
                          🏦 {e.accountNumber ?? "—"}
                        </div>
                      </div>
                      <span className={`ev-badge ${st.cls}`}>
                        {st.icon} {st.label}
                      </span>
                    </div>

                    {/* info grid */}
                    <div className="ev-card__info">
                      <InfoChip icon="📅" label="Start" value={formatDate(e.startDate)} />
                      <InfoChip icon="🔒" label="Closing" value={formatDate(e.closingDate)} />
                      <InfoChip icon="🏁" label="End" value={formatDate(e.endDate)} />
                      <InfoChip icon="👑" label="Director" value={e.director?.name ?? "—"} />
                      <InfoChip icon="👥" label="Team Leader" value={e.teamLeader?.name ?? "—"} />
                    </div>

                    {/* budget section */}
                    <div className="ev-card__budget">
                      <div className="ev-card__budget-row">
                        <div className="ev-card__budget-item">
                          <span className="ev-card__budget-lbl">Budget</span>
                          <span className="ev-card__budget-val">{formatINR(budget)}</span>
                        </div>
                        <div className="ev-card__budget-item ev-card__budget-item--right">
                          <span className="ev-card__budget-lbl">Spent</span>
                          <span className={`ev-card__budget-val ${over ? "ev-card__budget-val--over" : "ev-card__budget-val--ok"}`}>
                            {formatINR(spent)}
                          </span>
                        </div>
                        <div className="ev-card__budget-item ev-card__budget-item--right">
                          <span className="ev-card__budget-lbl">Remaining</span>
                          <span className={`ev-card__budget-val ${over ? "ev-card__budget-val--over" : ""}`}>
                            {formatINR(Math.max(budget - spent, 0))}
                          </span>
                        </div>
                      </div>

                      {/* progress bar */}
                      <div className="ev-card__bar-track">
                        <div
                          className={`ev-card__bar-fill ${over ? "ev-card__bar-fill--over" : ""}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="ev-card__bar-labels">
                        <span>{pct.toFixed(0)}% spent</span>
                        {over && <span className="ev-card__over-tag">⚠️ Over budget</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* helpers */
function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="ev-chip">
      <span className="ev-chip__ico">{icon}</span>
      <div className="ev-chip__body">
        <span className="ev-chip__lbl">{label}</span>
        <span className="ev-chip__val">{value}</span>
      </div>
    </div>
  );
}