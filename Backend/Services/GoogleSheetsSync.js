const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { loadGoogleSheetsConfig, resolveSpreadsheetId: resolveSpreadsheetIdFromConfig } = require("../config/googleSheets");

const EVENTS_SHEET = "Events";
const BILLS_SHEET = "Bills";
const DETAILS_SHEET = "ClosingSheetDetails";
const EVENT_SUMMARY_SHEET = "Event Summary";
const EMPLOYEE_SUMMARY_SHEET = "Employee Summary";
const BILLS_DETAILS_SHEET = "Bills Details";
const CLOSING_SHEET_REPORT = "Closing Sheet";

const EVENT_HEADERS = [
  "Event ID",
  "Event Code",
  "Event Name",
  "Director",
  "Team Leader",
  "Budget",
  "Start Date",
  "End Date",
  "Status"
];

const BILL_HEADERS = [
  "Bill ID",
  "Event ID",
  "Vendor",
  "Amount",
  "Paid By",
  "Status",
  "Image"
];

const DETAILS_EVENT_HEADERS = [
  "Event Name",
  "Event ID",
  "Date",
  "Start Date",
  "Closing Date",
  "End Date",
  "Budget",
  "Status",
  "Director",
  "Team Leader"
];

const DETAILS_EMP_HEADERS = [
  "Employee Name",
  "Total Bills",
  "Total Spent",
  "Own Amount",
  "Company Amount",
  "Advance",
  "Return",
  "Owed"
];

const DETAILS_BILL_HEADERS = ["Vendor", "Employee", "Amount", "Paid By", "Payment Type", "Status"];

let sheetsClientPromise = null;
let sheetsInitLogged = false;
let sheetsConfigWarned = false;

function resolveSpreadsheetId() {
  return resolveSpreadsheetIdFromConfig();
}

function getGoogleSheetUrl() {
  const id = resolveSpreadsheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : "";
}

function getGoogleSheetTabUrl(sheetId) {
  const id = resolveSpreadsheetId();
  if (!id) {
    return "";
  }
  if (!Number.isFinite(Number(sheetId))) {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
  return `https://docs.google.com/spreadsheets/d/${id}/edit#gid=${Number(sheetId)}`;
}

function toISODate(dateValue) {
  if (!dateValue) {
    return "";
  }
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toISOString().slice(0, 10);
}

function toYMD(dateValue) {
  if (!dateValue) {
    return "";
  }
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toISOString().slice(0, 10);
}

function formatINR(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) {
    return "₹0";
  }
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(num);
  } catch {
    return `₹${Math.round(num)}`;
  }
}

function toISODateTime(dateValue) {
  if (!dateValue) {
    return "";
  }
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toISOString();
}

function toGoogleImageFormula(urlValue) {
  const raw = String(urlValue || "").trim();
  if (!raw) {
    return "";
  }
  const escaped = raw.replace(/"/g, '""');
  return `=IFERROR(IMAGE("${escaped}"),"${escaped}")`;
}

function readServiceAccountConfig() {
  const cfg = loadGoogleSheetsConfig();
  if (!cfg.ok || !cfg.credentials) {
    throw new Error(`[Google Sheets] ${cfg.reason || "Google Sheets credentials missing"}`);
  }
  return cfg.credentials;
}

function getServiceAccountEmail() {
  const cfg = loadGoogleSheetsConfig();
  return String(cfg?.credentials?.client_email || "").trim();
}

function toSheetsError(error, action) {
  const message = String(error?.message || error || "Unknown Google Sheets error");
  const spreadsheetId = resolveSpreadsheetId();
  let serviceEmail = "";
  try {
    serviceEmail = getServiceAccountEmail();
  } catch {
    serviceEmail = "";
  }
  const missingFile = message.includes("Credentials file not found");
  const invalidCreds = message.includes("Invalid GOOGLE_SERVICE_ACCOUNT_JSON");
  const authFailed = message.toLowerCase().includes("authentication failed");
  const credentialsMissing = message.toLowerCase().includes("credentials missing");
  const missingCredentialsPhrase = message.toLowerCase().includes("google credentials file missing");
  const denied =
    message.toLowerCase().includes("does not have permission") ||
    message.toLowerCase().includes("permission denied") ||
    message.toLowerCase().includes("insufficient permissions");

  if (!denied && !missingFile && !invalidCreds && !authFailed && !credentialsMissing && !missingCredentialsPhrase) {
    return error;
  }

  const hintParts = [
    `[Google Sheets] ${action} failed: ${message}`,
    spreadsheetId ? `Spreadsheet ID: ${spreadsheetId}` : "Spreadsheet ID is missing",
    serviceEmail
      ? `Share this sheet with Editor access to: ${serviceEmail}`
      : "Service account email not found (check credentials file)"
  ];
  return new Error(hintParts.join(" | "));
}

async function getSheetsClient() {
  if (sheetsClientPromise) {
    return sheetsClientPromise;
  }

  sheetsClientPromise = (async () => {
    const cfg = loadGoogleSheetsConfig();
    if (!cfg.ok || !cfg.credentials || !cfg.spreadsheetId) {
      if (!sheetsConfigWarned) {
        console.warn(`[Google Sheets] Disabled: ${cfg.reason || "Google Sheets credentials missing"}`);
        sheetsConfigWarned = true;
      }
      return null;
    }
    const creds = cfg.credentials;
    const spreadsheetId = cfg.spreadsheetId;

    if (!sheetsInitLogged) {
      const serviceEmail = String(creds?.client_email || "").trim();
      console.log(
        `[Google Sheets] Initializing client | spreadsheetId=${spreadsheetId} | serviceAccount=${
          serviceEmail || "unknown"
        }`
      );
      sheetsInitLogged = true;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly"
      ]
    });
    let client;
    try {
      client = await auth.getClient();
    } catch (error) {
      throw new Error(`[Google Sheets] Authentication failed: ${error.message}`);
    }
    return google.sheets({ version: "v4", auth: client });
  })();

  return sheetsClientPromise;
}

async function getAccessTokenForSheetsExport() {
  const cfg = loadGoogleSheetsConfig();
  if (!cfg.ok || !cfg.credentials) {
    throw new Error(`[Google Sheets] ${cfg.reason || "Google Sheets credentials missing"}`);
  }
  const creds = cfg.credentials;
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  return String(token || "").trim();
}

function toSafeFileName(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildGoogleExportPdfUrl({ spreadsheetId, gid }) {
  const params = new URLSearchParams({
    format: "pdf",
    gid: String(gid),
    size: "A4",
    portrait: "false", // landscape
    fitw: "true", // fit to width
    sheetnames: "false",
    printtitle: "false",
    pagenumbers: "false",
    gridlines: "false",
    fzr: "true",
    top_margin: "0.40",
    bottom_margin: "0.40",
    left_margin: "0.35",
    right_margin: "0.35",
    horizontal_alignment: "CENTER",
    vertical_alignment: "TOP"
  });
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(String(spreadsheetId))}/export?${params.toString()}`;
}

async function fetchPdfBufferWithAuth(url, token) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf"
    },
    redirect: "follow"
  });

  const finalUrl = String(response.url || "");
  const bodyBuffer = Buffer.from(await response.arrayBuffer());

  if (response.status >= 200 && response.status < 300) {
    console.log(`[Google Sheets] Redirect followed successfully | finalUrl=${finalUrl || "n/a"} | status=${response.status}`);
    return bodyBuffer;
  }

  const bodyText = bodyBuffer.toString("utf8").slice(0, 400);
  if (response.status === 401) {
    throw new Error(`[Google Sheets] Auth failed | status=401 | ${bodyText || "Unauthorized"}`);
  }
  if (response.status === 403) {
    throw new Error(`[Google Sheets] Permission denied | status=403 | ${bodyText || "Forbidden"}`);
  }
  if (response.status === 404) {
    throw new Error(`[Google Sheets] Invalid spreadsheet or sheet | status=404 | ${bodyText || "Not found"}`);
  }
  if (response.status === 302 || response.status === 307) {
    throw new Error(`[Google Sheets] Redirect not resolved | status=${response.status} | ${bodyText || "Temporary redirect"}`);
  }

  throw new Error(
    `[Google Sheets] Export PDF failed | status=${response.status} | body=${bodyText || "Empty response body"}`
  );
}

async function exportSheetTabAsPdfBuffer({ spreadsheetId, gid }) {
  const token = await getAccessTokenForSheetsExport();
  if (!token) {
    throw new Error("[Google Sheets] Export PDF failed: access token missing");
  }

  const url = buildGoogleExportPdfUrl({ spreadsheetId, gid });
  return fetchPdfBufferWithAuth(url, token);
}

async function exportClosingSheetDetailsPdfBuffer({ eventId = "", eventName = "", saveToDisk = true } = {}) {
  const spreadsheetId = resolveSpreadsheetId();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    return { ok: false, reason: "Google Sheets credentials missing", buffer: null };
  }

  try {
    const sheetIdByTitle = await ensureSheetsExist(sheets, spreadsheetId, [DETAILS_SHEET]);
    const gid = Number(sheetIdByTitle.get(DETAILS_SHEET));
    if (!Number.isFinite(gid)) {
      throw new Error("[Google Sheets] ClosingSheetDetails tab gid missing");
    }
    const buffer = await exportSheetTabAsPdfBuffer({ spreadsheetId, gid });

    const safeEventId = toSafeFileName(eventId) || "unknown_event";
    const prettyName = toSafeFileName(eventName);
    const year = String(new Date().getFullYear());
    const professionalFileName = prettyName
      ? `${prettyName}_${year}_Closing_Sheet.pdf`
      : `event-${safeEventId}.pdf`;

    let savedPath = "";
    if (saveToDisk) {
      const exportsDir = path.resolve(__dirname, "..", "exports");
      fs.mkdirSync(exportsDir, { recursive: true });
      savedPath = path.join(exportsDir, professionalFileName);
      fs.writeFileSync(savedPath, buffer);
      console.log(`[Google Sheets] PDF generated | path=${savedPath}`);
    } else {
      console.log("[Google Sheets] PDF generated");
    }

    return { ok: true, buffer, gid, fileName: professionalFileName, savedPath };
  } catch (error) {
    throw toSheetsError(error, "Export closing report PDF");
  }
}

function colToLabel(colNumber) {
  let n = colNumber;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

async function ensureSheetWithHeaders(sheets, spreadsheetId, sheetTitle, headers) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (meta.data.sheets || []).find((s) => s.properties && s.properties.title === sheetTitle);
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetTitle } } }]
      }
    });
  }

  const headerRange = `${sheetTitle}!A1:${colToLabel(headers.length)}1`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: headerRange,
    valueInputOption: "RAW",
    requestBody: { values: [headers] }
  });
}

async function ensureSheetsExist(sheets, spreadsheetId, sheetTitles = []) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = meta.data.sheets || [];
  const byTitle = new Map(
    existingSheets.map((s) => [String(s.properties?.title || ""), Number(s.properties?.sheetId)])
  );

  const missing = sheetTitles.filter((title) => !byTitle.has(title));
  if (missing.length) {
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } }))
      }
    });
    const replies = addRes.data?.replies || [];
    replies.forEach((reply, idx) => {
      const title = missing[idx];
      const sheetId = Number(reply?.addSheet?.properties?.sheetId);
      if (title && Number.isFinite(sheetId)) {
        byTitle.set(title, sheetId);
      }
    });
  }

  return byTitle;
}

async function clearAndWriteSheetTable(sheets, spreadsheetId, sheetTitle, headers, rows = []) {
  const width = Math.max(headers.length, ...(rows.map((r) => r.length)), 1);
  const allRows = [headers, ...rows];
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetTitle}!A:ZZ`
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTitle}!A1:${colToLabel(width)}${allRows.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: allRows }
  });
}

async function formatReportSheets(sheets, spreadsheetId, sheetIdByTitle, headerLengthsByTitle) {
  const requests = [];
  const titles = Object.keys(headerLengthsByTitle);
  for (const title of titles) {
    const sheetId = Number(sheetIdByTitle.get(title));
    const headerLen = Number(headerLengthsByTitle[title] || 1);
    if (!Number.isFinite(sheetId)) {
      continue;
    }

    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 }
        },
        fields: "gridProperties.frozenRowCount"
      }
    });
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: headerLen
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.92, green: 0.95, blue: 1 }
          }
        },
        fields: "userEnteredFormat(textFormat,backgroundColor)"
      }
    });
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: Math.max(headerLen, 1)
        }
      }
    });
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  }
}

function assert2DArray(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`[Google Sheets] ${label} is empty or not an array`);
  }
  if (!values.every((row) => Array.isArray(row))) {
    throw new Error(`[Google Sheets] ${label} must be a 2D array`);
  }
}

async function appendRowsToSheet(sheets, spreadsheetId, sheetTitle, rows, label) {
  assert2DArray(rows, label);
  console.log(`[Google Sheets] Writing to sheet=${sheetTitle} range=${sheetTitle}!A1 rows=${rows.length}`);
  console.log(`[Google Sheets] Writing data to sheet:`, rows);
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetTitle}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows }
  });
  const updatedRows = Number(res.data?.updates?.updatedRows || 0);
  console.log(`[Google Sheets] Append done | sheet=${sheetTitle} | updatedRows=${updatedRows}`);
  return { appendedCount: rows.length, updatedRows };
}

async function upsertRowsById(sheets, spreadsheetId, sheetTitle, rows) {
  if (!rows.length) {
    return { updatedCount: 0, appendedCount: 0 };
  }

  const idColumn = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetTitle}!A2:A`
  });

  const existingIds = idColumn.data.values || [];
  const idToRow = new Map();
  existingIds.forEach((entry, idx) => {
    const key = String(entry?.[0] ?? "").trim();
    if (key) {
      idToRow.set(key, idx + 2);
    }
  });

  const updates = [];
  const appends = [];

  for (const row of rows) {
    const key = String(row?.[0] ?? "").trim();
    if (!key) {
      continue;
    }
    const targetRow = idToRow.get(key);
    if (targetRow) {
      const range = `${sheetTitle}!A${targetRow}:${colToLabel(row.length)}${targetRow}`;
      updates.push({ range, values: [row] });
    } else {
      appends.push(row);
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: updates
      }
    });
  }

  if (appends.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetTitle}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: appends }
    });
  }
  return { updatedCount: updates.length, appendedCount: appends.length };
}

function makeEventRow(event) {
  const director = event?.director || {};
  const teamLeader = event?.teamLeader || {};
  return [
    String(event?._id || event?.id || ""),
    String(event?.accountNumber || ""),
    String(event?.activityName || ""),
    String(director?.name || director?.email || ""),
    String(teamLeader?.name || teamLeader?.email || ""),
    Number(event?.budget || 0),
    toISODate(event?.startDate),
    toISODate(event?.endDate),
    String(event?.status || "").toUpperCase()
  ];
}

function makeBillRow(bill, event) {
  const normalizedPaidBy = String(bill?.paidBy || "");
  const paidBy = normalizedPaidBy === "own" ? "self" : normalizedPaidBy;

  return [
    String(bill?._id || bill?.id || ""),
    String(event?._id || event?.id || bill?.event || ""),
    String(bill?.entityName || ""),
    Number(bill?.amount || 0),
    String(paidBy || "company").toUpperCase(),
    String(bill?.status || "").toUpperCase(),
    toGoogleImageFormula(bill?.voucherUrl)
  ];
}

async function syncEventsToGoogleSheet(events = []) {
  const spreadsheetId = resolveSpreadsheetId();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    return { ok: false, reason: "Google Sheets credentials missing" };
  }

  try {
    await ensureSheetWithHeaders(sheets, spreadsheetId, EVENTS_SHEET, EVENT_HEADERS);
    const rows = events.map((ev) => makeEventRow(ev));
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${EVENTS_SHEET}!A2:I`
    });
    const result = rows.length
      ? await appendRowsToSheet(sheets, spreadsheetId, EVENTS_SHEET, rows, "events rows")
      : { appendedCount: 0 };
    console.log(
      `[Google Sheets] Data written to Events sheet | rows=${result.appendedCount}`
    );
  } catch (error) {
    throw toSheetsError(error, "Sync events");
  }
  return { ok: true };
}

async function syncBillsToGoogleSheet(bills = [], eventById = new Map()) {
  const spreadsheetId = resolveSpreadsheetId();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    return { ok: false, reason: "Google Sheets credentials missing" };
  }

  try {
    await ensureSheetWithHeaders(sheets, spreadsheetId, BILLS_SHEET, BILL_HEADERS);
    const rows = bills.map((bill) => {
      const evId = String(bill?.event?._id || bill?.event || "");
      const event = eventById.get(evId) || bill?.event || null;
      return makeBillRow(bill, event);
    });
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${BILLS_SHEET}!A2:G`
    });
    const result = rows.length
      ? await appendRowsToSheet(sheets, spreadsheetId, BILLS_SHEET, rows, "bills rows")
      : { appendedCount: 0 };
    console.log(
      `[Google Sheets] Data written to Bills sheet | rows=${result.appendedCount}`
    );
  } catch (error) {
    throw toSheetsError(error, "Sync bills");
  }
  return { ok: true };
}

async function readEventsFromGoogleSheet() {
  const spreadsheetId = resolveSpreadsheetId();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    return { ok: false, reason: "Google Sheets credentials missing", rows: [] };
  }

  let res;
  try {
    await ensureSheetWithHeaders(sheets, spreadsheetId, EVENTS_SHEET, EVENT_HEADERS);
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${EVENTS_SHEET}!A2:I`
    });
  } catch (error) {
    throw toSheetsError(error, "Read events");
  }

  const rows = (res.data.values || []).map((r) => ({
    id: String(r[0] || ""),
    accountNumber: String(r[1] || ""),
    activityName: String(r[2] || ""),
    startDate: String(r[6] || ""),
    closingDate: "",
    status: String(r[8] || "")
  }));
  return { ok: true, rows };
}

function buildClosingDetailsRows(payload) {
  const event = payload?.event || {};
  const employeeRows = Array.isArray(payload?.rows) ? payload.rows : [];
  const bills = Array.isArray(payload?.bills) ? payload.bills : [];
  const eventId = String(event.id || event._id || "").trim();
  const director = event?.director?.name || event?.director?.email || "";
  const teamLeader = event?.teamLeader?.name || event?.teamLeader?.email || "";

  const sectionRows = [
    [`EVENT::${eventId}::START`],
    ["--- Event Details ---"],
    DETAILS_EVENT_HEADERS,
    [
      String(event.activityName || ""),
      eventId,
      toYMD(event.date),
      toYMD(event.startDate),
      toYMD(event.closingDate),
      toYMD(event.endDate),
      Number(event.budget || 0),
      String(event.status || "").toUpperCase(),
      String(director || ""),
      String(teamLeader || "")
    ],
    [],
    ["--- Employee Summary ---"],
    DETAILS_EMP_HEADERS,
    ...employeeRows.map((r) => [
      String(r?.user?.name || r?.user?.email || ""),
      Number(r?.metrics?.bills || 0),
      Number(r?.metrics?.spent || 0),
      Number(r?.metrics?.own || 0),
      Number(r?.metrics?.company || 0),
      Number(r?.metrics?.advance || 0),
      Number(r?.metrics?.return || 0),
      Number(r?.metrics?.owed || 0)
    ]),
    [],
    ["--- Bills ---"],
    DETAILS_BILL_HEADERS,
    ...bills.map((b) => [
      String(b?.entityName || ""),
      String(b?.contactPerson?.name || b?.contactPerson?.email || ""),
      Number(b?.amount || 0),
      String(b?.paidBy || "").toUpperCase(),
      String(b?.paymentType || ""),
      String(b?.status || "").toUpperCase()
    ]),
    [`EVENT::${eventId}::END`],
    []
  ];

  return sectionRows;
}

async function syncClosingSheetDetailsToGoogleSheet(payload) {
  const spreadsheetId = resolveSpreadsheetId();
  const sheets = await getSheetsClient();
  const eventId = String(payload?.event?.id || payload?.event?._id || "").trim();
  if (!sheets || !spreadsheetId || !eventId) {
    return { ok: false, reason: "Google Sheets credentials missing or event id missing" };
  }

  try {
    await ensureSheetWithHeaders(sheets, spreadsheetId, DETAILS_SHEET, ["Section"]);
    const markerRange = `${DETAILS_SHEET}!A:A`;
    const markerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: markerRange });
    const col = markerRes.data.values || [];
    const startMarker = `EVENT::${eventId}::START`;
    const endMarker = `EVENT::${eventId}::END`;

    let startRow = 0;
    let endRow = 0;
    for (let i = 0; i < col.length; i += 1) {
      const val = String(col[i]?.[0] || "").trim();
      if (val === startMarker) {
        startRow = i + 1;
      }
      if (val === endMarker) {
        endRow = i + 1;
      }
    }

    const rows = buildClosingDetailsRows(payload);
    const width = Math.max(...rows.map((r) => r.length), 1);
    const targetRange = (rowNum) =>
      `${DETAILS_SHEET}!A${rowNum}:${colToLabel(width)}${rowNum + rows.length - 1}`;

    let appendedCount = 0;
    let updatedCount = 0;

    if (startRow && endRow && endRow >= startRow) {
      const oldWidth = Math.max(width, 12);
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${DETAILS_SHEET}!A${startRow}:${colToLabel(oldWidth)}${endRow}`
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: targetRange(startRow),
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows }
      });
      updatedCount = rows.length;
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${DETAILS_SHEET}!A1`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows }
      });
      appendedCount = rows.length;
    }

    console.log(
      `[Google Sheets] Closing details sync success | eventId=${eventId} | updated=${updatedCount} | appended=${appendedCount}`
    );
    return { ok: true, updatedCount, appendedCount };
  } catch (error) {
    throw toSheetsError(error, "Sync closing details");
  }
}

function toClosingReportTables(payload = {}) {
  const event = payload?.event || {};
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const bills = Array.isArray(payload?.bills) ? payload.bills : [];
  const eventDate = toYMD(event.date || event.startDate || event.closingDate || event.endDate);
  const director = event?.director?.name || event?.director?.email || "";
  const teamLeader = event?.teamLeader?.name || event?.teamLeader?.email || "";

  const totals = rows.reduce(
    (acc, row) => {
      acc.spent += Number(row?.metrics?.spent || 0);
      acc.companyOwes += Number(row?.metrics?.owed || 0);
      acc.employeeReturn += Number(row?.metrics?.return || 0);
      return acc;
    },
    { spent: 0, companyOwes: 0, employeeReturn: 0 }
  );

  const eventSummaryHeaders = [
    "Event Name",
    "Closing Number",
    "Start Date",
    "End Date",
    "Closing Date",
    "Budget",
    "Total Spent",
    "Company Owes",
    "Employee Return",
    "Director",
    "Team Leader"
  ];
  const eventSummaryRows = [
    [
      String(event.activityName || ""),
      String(event.accountNumber || ""),
      toYMD(event.startDate),
      toYMD(event.endDate),
      toYMD(event.closingDate),
      Number(event.budget || 0),
      Number(totals.spent || 0),
      Number(totals.companyOwes || 0),
      Number(totals.employeeReturn || 0),
      String(director),
      String(teamLeader)
    ]
  ];

  const employeeSummaryHeaders = [
    "Employee Name",
    "Total Bills",
    "Total Spent",
    "Own Amount",
    "Company Paid",
    "Advance",
    "Return",
    "Owed"
  ];
  const employeeSummaryRows = rows.map((row) => [
    String(row?.user?.name || row?.user?.email || ""),
    Number(row?.metrics?.bills || 0),
    Number(row?.metrics?.spent || 0),
    Number(row?.metrics?.own || 0),
    Number(row?.metrics?.company || 0),
    Number(row?.metrics?.advance || 0),
    Number(row?.metrics?.return || 0),
    Number(row?.metrics?.owed || 0)
  ]);

  const billsDetailsHeaders = [
    "Vendor Name",
    "Employee",
    "Item Description",
    "Quantity",
    "Rate",
    "Amount",
    "Payment Type (Cash/Company)",
    "Status (Approved/Pending)"
  ];
  const billsDetailsRows = bills.map((bill) => {
    const qty = 1;
    const amount = Number(bill?.amount || 0);
    const rate = qty ? amount / qty : amount;
    const paidBy = String(bill?.paidBy || "").toLowerCase();
    const paymentDisplay = paidBy === "own" || paidBy === "self" ? "Cash" : "Company";
    const statusDisplay = String(bill?.status || "").toLowerCase() === "approved" ? "Approved" : "Pending";
    return [
      String(bill?.entityName || ""),
      String(bill?.contactPerson?.name || bill?.contactPerson?.email || ""),
      String(bill?.description || bill?.category || ""),
      qty,
      Number(rate || 0),
      amount,
      paymentDisplay,
      statusDisplay
    ];
  });

  const closingSheetHeaders = [
    "Date",
    "Activity Name",
    "Person Name",
    "Closing Amount",
    "Cash Amount",
    "Signatures"
  ];
  const closingSheetRows = rows.length
    ? rows.map((row, idx) => [
        eventDate,
        String(event.activityName || ""),
        String(row?.user?.name || row?.user?.email || ""),
        Number(row?.metrics?.spent || 0),
        idx === 0 ? Number(event.cashAmount || 0) : "",
        idx === 0 ? String(event.sign || "") : ""
      ])
    : [[eventDate, String(event.activityName || ""), "", 0, Number(event.cashAmount || 0), String(event.sign || "")]];

  return {
    eventSummaryHeaders,
    eventSummaryRows,
    employeeSummaryHeaders,
    employeeSummaryRows,
    billsDetailsHeaders,
    billsDetailsRows,
    closingSheetHeaders,
    closingSheetRows
  };
}

async function syncClosingReportToGoogleSheet(payload) {
  const spreadsheetId = resolveSpreadsheetId();
  const sheets = await getSheetsClient();
  if (!sheets || !spreadsheetId) {
    return { ok: false, reason: "Google Sheets credentials missing" };
  }

  try {
    const event = payload?.event || {};
    const employeeRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const bills = Array.isArray(payload?.bills) ? payload.bills : [];

    const totalSpent = employeeRows.reduce((sum, row) => sum + Number(row?.metrics?.spent || 0), 0);
    const companyOwes = employeeRows.reduce((sum, row) => sum + Number(row?.metrics?.owed || 0), 0);
    const employeesReturn = employeeRows.reduce((sum, row) => sum + Number(row?.metrics?.return || 0), 0);

    const directorEmail = String(event?.director?.email || "-");
    const teamLeaderEmail = String(event?.teamLeader?.email || "-");
    const teamLeaderName = String(event?.teamLeader?.name || "-");

    const dateText = toYMD(event.date) || "-";
    const startDateText = toYMD(event.startDate) || "-";
    const closingDateText = toYMD(event.closingDate) || "-";
    const endDateText = toYMD(event.endDate) || "-";

    // We keep a fixed 9-column layout to match the invoice-style tables.
    const COLS = 9;
    const makeEmptyRow = () => Array.from({ length: COLS }, () => "");
    const makeHeadingRow = (title) => {
      const row = makeEmptyRow();
      row[0] = String(title || "");
      return row;
    };
    const makeKVRow = (label, value) => {
      const row = makeEmptyRow();
      row[0] = String(label || "");
      row[1] = String(value ?? "");
      return row;
    };
    const makeMoney = (n) => formatINR(Number(n || 0));

    const values = [];
    let rowCursor1 = 1; // 1-based row numbers for easier math
    const pushRow = (rowArr) => {
      const row = Array.isArray(rowArr) ? rowArr.slice(0, COLS) : makeEmptyRow();
      while (row.length < COLS) row.push("");
      values.push(row);
      const currentRow = rowCursor1;
      rowCursor1 += 1;
      return currentRow;
    };

    // ---- Build values in the exact 5-section report order ----
    const titleRow = pushRow(makeHeadingRow("CLOSING SHEET DETAILS"));
    pushRow(makeEmptyRow());

    // Section 1
    pushRow(makeKVRow("Event Name", event.activityName || ""));
    pushRow(makeKVRow("Closing Number", event.accountNumber || ""));
    pushRow(makeKVRow("Date", dateText));
    pushRow(makeKVRow("Start Date", startDateText));
    pushRow(makeKVRow("Closing Date", closingDateText));
    pushRow(makeKVRow("End Date", endDateText));
    pushRow(makeKVRow("Budget", makeMoney(event.budget)));
    pushRow(makeKVRow("Cash Amount", makeMoney(event.cashAmount)));
    pushRow(makeKVRow("Status", String(event.status || "")));
    pushRow(makeKVRow("Director", directorEmail || "-"));
    pushRow(makeKVRow("Team Leader", teamLeaderEmail || "-"));
    pushRow(makeEmptyRow());

    // Section 2
    const financialHeadingRow = pushRow(makeHeadingRow("FINANCIAL SUMMARY"));
    pushRow(makeKVRow("Total Spent", makeMoney(totalSpent)));
    pushRow(makeKVRow("Company Owes", makeMoney(companyOwes)));
    pushRow(makeKVRow("Employees Return", makeMoney(employeesReturn)));
    pushRow(makeEmptyRow());

    // Section 3
    const employeeHeadingRow = pushRow(makeHeadingRow("EMPLOYEE SUMMARY"));
    const employeeHeaderRow = pushRow([
      "Employee",
      "Bills",
      "Spent",
      "Own",
      "Company",
      "Advance",
      "Return",
      "Owed",
      ""
    ]);
    for (const emp of employeeRows) {
      pushRow([
        String(emp?.user?.name || emp?.user?.email || ""),
        Number(emp?.metrics?.bills || 0),
        makeMoney(emp?.metrics?.spent),
        makeMoney(emp?.metrics?.own),
        makeMoney(emp?.metrics?.company),
        makeMoney(emp?.metrics?.advance),
        makeMoney(emp?.metrics?.return),
        makeMoney(emp?.metrics?.owed),
        ""
      ]);
    }
    pushRow(makeEmptyRow());

    // Section 4
    const billsHeadingRow = pushRow(makeHeadingRow("BILLS DETAILS"));
    const billsHeaderRow = pushRow([
      "Vendor",
      "Employee",
      "Item Description",
      "Quantity",
      "Rate",
      "Amount",
      "Paid By",
      "Payment Type",
      "Status"
    ]);
    for (const bill of bills) {
      const amount = Number(bill?.amount || 0);
      const qty = 1;
      const rate = qty ? amount / qty : amount;
      const paidByDisplay = String(bill?.paidBy || "-").toUpperCase();
      const paymentTypeDisplay = String(bill?.paymentType || "-").toUpperCase();
      const statusDisplay = String(bill?.status || "-").toUpperCase();
      pushRow([
        String(bill?.entityName || ""),
        String(bill?.contactPerson?.name || bill?.contactPerson?.email || ""),
        String(bill?.description || bill?.category || ""),
        qty,
        makeMoney(rate),
        makeMoney(amount),
        paidByDisplay,
        paymentTypeDisplay,
        statusDisplay
      ]);
    }
    pushRow(makeEmptyRow());

    // Section 5
    pushRow(makeHeadingRow("CLOSING FORM"));
    const closingFormPairsStartRow = rowCursor1; // next pushed row will be first pair
    pushRow(makeKVRow("Activity Name", event.activityName || ""));
    pushRow(makeKVRow("Person Name", teamLeaderName || "-"));
    pushRow(makeKVRow("Closing Amount", makeMoney(totalSpent)));
    pushRow(makeKVRow("Cash Amount", makeMoney(event.cashAmount)));
    pushRow(makeKVRow("Sign", event.sign || ""));
    pushRow(makeKVRow("Approved By", directorEmail || "-"));

    const sheetIdByTitle = await ensureSheetsExist(sheets, spreadsheetId, [DETAILS_SHEET]);
    const sheetId = Number(sheetIdByTitle.get(DETAILS_SHEET));

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${DETAILS_SHEET}!A:ZZ`
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${DETAILS_SHEET}!A1:${colToLabel(COLS)}${values.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values }
    });

    // ---- Styling (headings, merged title row, table borders, auto column width) ----
    const borderColor = { red: 0.4, green: 0.4, blue: 0.4 };
    const borderStyle = "SOLID";
    const borderWidth = 1;

    const tableHeaderBg = { red: 0.92, green: 0.95, blue: 1 };

    const requests = [];

    // Merge title row (A:I)
    if (Number.isFinite(sheetId)) {
      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: titleRow - 1,
            endRowIndex: titleRow,
            startColumnIndex: 0,
            endColumnIndex: COLS
          },
          mergeType: "MERGE_ALL"
        }
      });
    }

    if (Number.isFinite(sheetId)) {
      const closingFormHeadingRow = closingFormPairsStartRow - 1;
      const sectionHeadingRows = [titleRow, financialHeadingRow, employeeHeadingRow, billsHeadingRow, closingFormHeadingRow];
      const uniqueSectionHeadingRows = Array.from(new Set(sectionHeadingRows)).filter((r) => Number.isFinite(r));

      for (const r of uniqueSectionHeadingRows) {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: r - 1,
              endRowIndex: r,
              startColumnIndex: 0,
              endColumnIndex: COLS
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                  fontSize: 16
                },
                backgroundColor: { red: 0.92, green: 0.95, blue: 1 }
              }
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)"
          }
        });
      }

      // Employee table borders
      const employeeHeaderRowIdx0 = employeeHeaderRow - 1;
      const employeeTableRowCount = 1 + employeeRows.length;
      requests.push({
        updateBorders: {
          range: {
            sheetId,
            startRowIndex: employeeHeaderRowIdx0,
            endRowIndex: employeeHeaderRowIdx0 + employeeTableRowCount,
            startColumnIndex: 0,
            endColumnIndex: 8
          },
          top: { style: borderStyle, width: borderWidth, color: borderColor },
          bottom: { style: borderStyle, width: borderWidth, color: borderColor },
          left: { style: borderStyle, width: borderWidth, color: borderColor },
          right: { style: borderStyle, width: borderWidth, color: borderColor },
          innerHorizontal: { style: borderStyle, width: 1, color: borderColor },
          innerVertical: { style: borderStyle, width: 1, color: borderColor }
        }
      });

      // Bills table borders
      const billsHeaderRowIdx0 = billsHeaderRow - 1;
      const billsTableRowCount = 1 + bills.length;
      requests.push({
        updateBorders: {
          range: {
            sheetId,
            startRowIndex: billsHeaderRowIdx0,
            endRowIndex: billsHeaderRowIdx0 + billsTableRowCount,
            startColumnIndex: 0,
            endColumnIndex: 9
          },
          top: { style: borderStyle, width: borderWidth, color: borderColor },
          bottom: { style: borderStyle, width: borderWidth, color: borderColor },
          left: { style: borderStyle, width: borderWidth, color: borderColor },
          right: { style: borderStyle, width: borderWidth, color: borderColor },
          innerHorizontal: { style: borderStyle, width: 1, color: borderColor },
          innerVertical: { style: borderStyle, width: 1, color: borderColor }
        }
      });

      // Closing form borders (A:B pairs)
      const closingPairsRowIdx0 = closingFormPairsStartRow - 1;
      requests.push({
        updateBorders: {
          range: {
            sheetId,
            startRowIndex: closingPairsRowIdx0,
            endRowIndex: closingPairsRowIdx0 + 6,
            startColumnIndex: 0,
            endColumnIndex: 2
          },
          top: { style: borderStyle, width: borderWidth, color: borderColor },
          bottom: { style: borderStyle, width: borderWidth, color: borderColor },
          left: { style: borderStyle, width: borderWidth, color: borderColor },
          right: { style: borderStyle, width: borderWidth, color: borderColor },
          innerHorizontal: { style: borderStyle, width: 1, color: borderColor },
          innerVertical: { style: borderStyle, width: 1, color: borderColor }
        }
      });

      // Table header styling
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: employeeHeaderRow - 1,
            endRowIndex: employeeHeaderRow,
            startColumnIndex: 0,
            endColumnIndex: 8
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 12 },
              backgroundColor: tableHeaderBg
            }
          },
          fields: "userEnteredFormat(textFormat,backgroundColor)"
        }
      });

      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: billsHeaderRow - 1,
            endRowIndex: billsHeaderRow,
            startColumnIndex: 0,
            endColumnIndex: 9
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 12 },
              backgroundColor: tableHeaderBg
            }
          },
          fields: "userEnteredFormat(textFormat,backgroundColor)"
        }
      });

      // Auto column width for A:I
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: COLS
          }
        }
      });
    }

    if (requests.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
    }

    return {
      ok: true,
      sheetUrl: getGoogleSheetTabUrl(sheetIdByTitle.get(DETAILS_SHEET))
    };
  } catch (error) {
    throw toSheetsError(error, "Sync structured closing report");
  }
}

module.exports = {
  syncEventsToGoogleSheet,
  syncBillsToGoogleSheet,
  syncClosingSheetDetailsToGoogleSheet,
  syncClosingReportToGoogleSheet,
  readEventsFromGoogleSheet,
  getGoogleSheetUrl,
  exportClosingSheetDetailsPdfBuffer
};
