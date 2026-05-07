const fs = require("fs");
const path = require("path");

function projectRoot() {
  return path.resolve(__dirname, "..", "..");
}

function ensureLocalCredentialsDir() {
  try {
    const dir = path.join(projectRoot(), "credentials");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    return "";
  }
}

function resolveSpreadsheetId() {
  const candidates = [
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    process.env.GOOGLE_SPREADSHEET_ID,
    process.env.GOOGLE_SHEET_ID,
    process.env.SHEET_ID
  ];
  for (const candidate of candidates) {
    const v = String(candidate || "").trim();
    if (v) return v;
  }
  return "";
}

function parseServiceAccountJsonEnv() {
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) {
    return { ok: false, reason: "GOOGLE_SERVICE_ACCOUNT_JSON is empty" };
  }
  try {
    const parsed = JSON.parse(raw);
    return { ok: true, credentials: parsed, source: "env_json" };
  } catch (error) {
    return {
      ok: false,
      reason: `Invalid GOOGLE_SERVICE_ACCOUNT_JSON: ${error.message}`
    };
  }
}

function candidateCredentialPaths() {
  const candidates = [];

  const envPath = String(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "").trim();
  if (envPath) {
    candidates.push(path.isAbsolute(envPath) ? envPath : path.resolve(projectRoot(), envPath));
  }

  // Local safe default
  candidates.push(path.join(projectRoot(), "credentials", "google-service-account.json"));

  // Backward-compatible repo-level patterns
  candidates.push(path.join(projectRoot(), "event-managment-494105-8ba260c3479b.json"));

  return Array.from(new Set(candidates));
}

function loadServiceAccountFromFile() {
  const paths = candidateCredentialPaths();
  for (const p of paths) {
    if (!p) continue;
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
      return { ok: true, credentials: parsed, source: "file", path: p };
    } catch (error) {
      return {
        ok: false,
        reason: `Invalid credential file JSON at ${p}: ${error.message}`
      };
    }
  }
  return {
    ok: false,
    reason:
      "Google credentials file missing. Please add service account JSON to ./credentials/google-service-account.json or set GOOGLE_SERVICE_ACCOUNT_JSON."
  };
}

function validateServiceAccountShape(credentials) {
  const email = String(credentials?.client_email || "").trim();
  const key = String(credentials?.private_key || "").trim();
  if (!email || !key) {
    return {
      ok: false,
      reason:
        "Invalid Google credentials object. Required keys: client_email, private_key."
    };
  }
  return { ok: true };
}

function loadGoogleSheetsConfig() {
  ensureLocalCredentialsDir();

  const spreadsheetId = resolveSpreadsheetId();
  if (!spreadsheetId) {
    return {
      ok: false,
      reason:
        "Invalid spreadsheet ID. Set GOOGLE_SHEETS_SPREADSHEET_ID (or GOOGLE_SPREADSHEET_ID / GOOGLE_SHEET_ID / SHEET_ID).",
      spreadsheetId: ""
    };
  }

  const fromJson = parseServiceAccountJsonEnv();
  if (fromJson.ok) {
    const shape = validateServiceAccountShape(fromJson.credentials);
    if (!shape.ok) {
      return { ok: false, reason: shape.reason, spreadsheetId };
    }
    return {
      ok: true,
      spreadsheetId,
      credentials: fromJson.credentials,
      source: fromJson.source
    };
  }

  const fromFile = loadServiceAccountFromFile();
  if (!fromFile.ok) {
    return { ok: false, reason: fromFile.reason, spreadsheetId };
  }

  const shape = validateServiceAccountShape(fromFile.credentials);
  if (!shape.ok) {
    return { ok: false, reason: shape.reason, spreadsheetId };
  }

  return {
    ok: true,
    spreadsheetId,
    credentials: fromFile.credentials,
    source: fromFile.source,
    credentialPath: fromFile.path || ""
  };
}

module.exports = {
  ensureLocalCredentialsDir,
  resolveSpreadsheetId,
  loadGoogleSheetsConfig
};

