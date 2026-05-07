import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useAuthedApi } from "../lib/api";
import "../App.css";

type Props = { open: boolean; onClose: () => void };

export function CreateEventModal({ open, onClose }: Props) {
  const api = useAuthedApi();
  const qc = useQueryClient();

  const [activityName, setActivityName] = useState("");
  const [Clossing_Number, setClossing_Number] = useState("");
  const [startDate, setStartDate] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [cashAmount, setCashAmount] = useState("0");
  const [sign, setSign] = useState("Admin");
  const [directorEmail, setDirectorEmail] = useState("");
  const [teamLeaderEmail, setTeamLeaderEmail] = useState("");
  const [employeeEmails, setEmployeeEmails] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1); // 1 = details, 2 = team

  const resetForm = () => {
    setActivityName(""); setClossing_Number(""); setStartDate("");
    setClosingDate(""); setEndDate(""); setBudget(""); setCashAmount("0");
    setSign("Admin"); setDirectorEmail(""); setTeamLeaderEmail("");
    setEmployeeEmails([""]); setError(null); setStep(1);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const budgetNum = Number(budget);
      const cashNum = Number(cashAmount);

      if (!activityName.trim()) throw new Error("Activity name is required");
      if (!Clossing_Number.trim()) throw new Error("Closing number is required");
      if (!startDate) throw new Error("Start date is required");
      if (Number.isNaN(budgetNum) || budgetNum < 0) throw new Error("Budget must be a valid number");
      if (Number.isNaN(cashNum) || cashNum < 0) throw new Error("Cash amount must be a valid number");
      if (!sign.trim()) throw new Error("Sign / reference is required");

      const uniqueEmails = [
        ...new Set(employeeEmails.map(e => e.trim().toLowerCase()).filter(Boolean)),
      ];
      if (!uniqueEmails.length) throw new Error("At least one employee email is required");

      if (closingDate && new Date(closingDate) < new Date(startDate))
        throw new Error("Closing date cannot be before start date");
      if (endDate && new Date(endDate) < new Date(startDate))
        throw new Error("End date cannot be before start date");
      if (closingDate && endDate && new Date(endDate) < new Date(closingDate))
        throw new Error("End date cannot be before closing date");

      const payload: Record<string, unknown> = {
        date: new Date(startDate).toISOString(),
        accountNumber: Clossing_Number.trim(),
        activityName: activityName.trim(),
        startDate: new Date(startDate).toISOString(),
        closingDate: closingDate ? new Date(closingDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        budget: budgetNum, cashAmount: cashNum,
        sign: sign.trim(), employeeEmails: uniqueEmails,
      };

      const de = directorEmail.trim().toLowerCase();
      const te = teamLeaderEmail.trim().toLowerCase();
      if (de) payload.directorEmail = de;
      if (te) payload.teamLeaderEmail = te;

      return (await api.post("/admin/events", payload)).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "events"] }); resetForm(); onClose(); },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
          ? (err as { response: { data: { message: string } } }).response.data.message
          : err instanceof Error ? err.message : "Failed to create event";
      setError(msg);
    },
  });

  if (!open) return null;

  return (
    <div
      className="cem-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
    >
      <div className="cem-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── rainbow top bar ── */}
        <div className="cem-glow-bar" />

        {/* ── HEADER ── */}
        <div className="cem-header">
          <div className="cem-header__left">
            <div className="cem-header__icon">📅</div>
            <div>
              <h2 className="cem-header__title">Create Event</h2>
              <p className="cem-header__sub">Set up a new event and assign your team.</p>
            </div>
          </div>
          <button className="cem-close" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── STEP TABS ── */}
        <div className="cem-steps">
          <button
            type="button"
            className={`cem-step ${step === 1 ? "cem-step--active" : ""}`}
            onClick={() => setStep(1)}
          >
            <span className="cem-step__num">1</span>
            <span className="cem-step__label">Event Details</span>
          </button>
          <div className="cem-step__line" />
          <button
            type="button"
            className={`cem-step ${step === 2 ? "cem-step--active" : ""}`}
            onClick={() => setStep(2)}
          >
            <span className="cem-step__num">2</span>
            <span className="cem-step__label">Team & Roles</span>
          </button>
        </div>

        {/* ── FORM ── */}
        <form
          className="cem-form"
          onSubmit={(e) => { e.preventDefault(); setError(null); createMut.mutate(); }}
        >

          {/* ═══ STEP 1 ═══ */}
          {step === 1 && (
            <div className="cem-section">

              <div className="cem-section__title">
                <span className="cem-section__ico">📋</span> Basic Info
              </div>

              <Field label="Activity Name" required icon="🎯">
                <input
                  className="cem-input"
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  placeholder="e.g. IPL Season 2026"
                  required
                />
              </Field>

              <Field label="Closing / Account Number" required icon="🏦">
                <input
                  className="cem-input"
                  value={Clossing_Number}
                  onChange={(e) => setClossing_Number(e.target.value)}
                  placeholder="e.g. CLO-2026-0001"
                  required
                />
              </Field>

              <div className="cem-section__title" style={{ marginTop: "0.5rem" }}>
                <span className="cem-section__ico">📅</span> Dates
              </div>

              <div className="cem-row">
                <Field label="Start Date" required icon="🚀">
                  <input
                    className="cem-input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </Field>
                <Field label="End Date" icon="🏁">
                  <input
                    className="cem-input"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Closing Date" icon="🔒">
                <input
                  className="cem-input"
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                />
              </Field>

              <div className="cem-section__title" style={{ marginTop: "0.5rem" }}>
                <span className="cem-section__ico">💰</span> Financials
              </div>

              <div className="cem-row">
                <Field label="Budget (₹)" required icon="📊">
                  <input
                    className="cem-input"
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="0"
                    required
                  />
                </Field>
                <Field label="Cash Amount (₹)" icon="💵">
                  <input
                    className="cem-input"
                    type="number"
                    min={0}
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0"
                  />
                </Field>
              </div>

              <Field label="Sign / Reference" required icon="✍️">
                <input
                  className="cem-input"
                  value={sign}
                  onChange={(e) => setSign(e.target.value)}
                  placeholder="Admin"
                  required
                />
              </Field>

              <div className="cem-footer">
                <button type="button" className="cem-btn cem-btn--ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="cem-btn cem-btn--primary"
                  onClick={() => setStep(2)}
                >
                  Next: Team & Roles →
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP 2 ═══ */}
          {step === 2 && (
            <div className="cem-section">

              <div className="cem-section__title">
                <span className="cem-section__ico">👥</span> Employee Emails
              </div>

              <div className="cem-employees">
                {employeeEmails.map((email, idx) => (
                  <div className="cem-employee-row" key={idx}>
                    <div className="cem-employee-row__num">{idx + 1}</div>
                    <input
                      className="cem-input"
                      type="email"
                      value={email}
                      placeholder="employee@company.com"
                      onChange={(e) => {
                        const updated = [...employeeEmails];
                        updated[idx] = e.target.value;
                        setEmployeeEmails(updated);
                      }}
                      required
                    />
                    {idx > 0 && (
                      <button
                        type="button"
                        className="cem-remove-btn"
                        onClick={() =>
                          setEmployeeEmails(employeeEmails.filter((_, i) => i !== idx))
                        }
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className="cem-add-btn"
                  onClick={() => setEmployeeEmails([...employeeEmails, ""])}
                >
                  <span>＋</span> Add Employee
                </button>
              </div>

              <div className="cem-section__title" style={{ marginTop: "0.5rem" }}>
                <span className="cem-section__ico">👑</span> Leadership (Optional)
              </div>

              <div className="cem-row">
                <Field label="Director Email" icon="👨‍💼">
                  <input
                    className="cem-input"
                    type="email"
                    value={directorEmail}
                    onChange={(e) => setDirectorEmail(e.target.value)}
                    placeholder="director@company.com"
                  />
                </Field>
                <Field label="Team Leader Email" icon="🧭">
                  <input
                    className="cem-input"
                    type="email"
                    value={teamLeaderEmail}
                    onChange={(e) => setTeamLeaderEmail(e.target.value)}
                    placeholder="leader@company.com"
                  />
                </Field>
              </div>

              {/* Summary preview */}
              {activityName && (
                <div className="cem-preview">
                  <div className="cem-preview__title">📋 Summary</div>
                  <div className="cem-preview__rows">
                    <PreviewRow label="Event" value={activityName} />
                    <PreviewRow label="Account" value={Clossing_Number || "—"} />
                    <PreviewRow label="Budget" value={budget ? `₹${Number(budget).toLocaleString("en-IN")}` : "—"} />
                    <PreviewRow label="Start" value={startDate || "—"} />
                    <PreviewRow label="Team" value={`${employeeEmails.filter(Boolean).length} employee(s)`} />
                  </div>
                </div>
              )}

              {error && (
                <div className="cem-error">
                  <span className="cem-error__ico">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="cem-footer">
                <button type="button" className="cem-btn cem-btn--ghost" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  type="submit"
                  className="cem-btn cem-btn--primary"
                  disabled={createMut.isPending}
                >
                  {createMut.isPending
                    ? <><span className="cem-spin" /> Creating…</>
                    : <><span>🚀</span> Create Event</>
                  }
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}

/* helpers */
function Field({
  label, icon, required, children,
}: {
  label: string; icon?: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div className="cem-field">
      <label className="cem-label">
        {icon && <span className="cem-label__ico">{icon}</span>}
        {label}
        {required && <span className="cem-label__req">*</span>}
      </label>
      {children}
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cem-preview__row">
      <span className="cem-preview__lbl">{label}</span>
      <span className="cem-preview__val">{value}</span>
    </div>
  );
}