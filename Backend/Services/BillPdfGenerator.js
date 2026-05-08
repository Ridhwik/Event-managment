/**
 * BillPdfGenerator.js
 *
 * Generates a PDF document containing:
 *   Page 1+  — Tabular bill-sheet data (sections, rows, totals)
 *   Page N+  — Each uploaded voucher image appended as a full page
 *
 * Uses PDFKit (no headless browser needed).
 */

const PDFDocument = require("pdfkit");
const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");

/* ═══════════════════════════════════════════
   COLOUR / LAYOUT CONSTANTS
   ═══════════════════════════════════════════ */
const COLORS = {
  navy:       "#0f172a",
  slate:      "#334155",
  white:      "#ffffff",
  lightGray:  "#f1f5f9",
  border:     "#cbd5db",
  text:       "#1f2937",
  muted:      "#6b7280",
  accent:     "#7c3aed",
  green:      "#16a34a",
  amber:      "#f59e0b",
};

const PAGE_MARGIN = 40;
const COL_WIDTHS = {
  srNo: 30,
  particular: 160,
  qty: 45,
  size: 55,
  rate: 60,
  amount: 70,
  remarks: 95,
};
const TABLE_WIDTH = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0);

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
function formatINR(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num)) return "₹0";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `₹${Math.round(num)}`;
  }
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Download an image from URL and return as a Buffer.
 *  Supports http, https, and local file paths (uploads/).
 */
function fetchImageBuffer(url, baseUrl) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);

    // Local file path (e.g. /uploads/xxx.png)
    if (url.startsWith("/uploads/") || url.startsWith("uploads/")) {
      const localPath = path.resolve(
        __dirname,
        "..",
        url.startsWith("/") ? url.slice(1) : url
      );
      if (fs.existsSync(localPath)) {
        try {
          resolve(fs.readFileSync(localPath));
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
      return;
    }

    // If relative URL but we have a baseUrl, make absolute
    let fullUrl = url;
    if (!/^https?:\/\//i.test(url) && baseUrl) {
      fullUrl = new URL(url, baseUrl).href;
    }
    if (!/^https?:\/\//i.test(fullUrl)) return resolve(null);

    const mod = fullUrl.startsWith("https") ? https : http;
    const req = mod.get(fullUrl, { timeout: 15000 }, (res) => {
      // Follow redirects
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchImageBuffer(res.headers.location, baseUrl).then(resolve);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return resolve(null);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => resolve(null));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/* ═══════════════════════════════════════════
   SECTION TEMPLATE (matches frontend order)
   ═══════════════════════════════════════════ */
const SECTION_TEMPLATE = [
  { key: "A", title: "SETUP AND INFRASTRUCTURE", match: /setup|infrastructure/i },
  { key: "B", title: "TENTAGE",                  match: /tentage/i },
  { key: "C", title: "FURNITURE",                 match: /furniture/i },
  { key: "D", title: "TECHNICALS",                match: /technical/i },
  { key: "E", title: "SERVICES",                  match: /service/i },
  { key: "F", title: "ENTERTAINMENT",             match: /entertainment/i },
];

function resolveOrderedSections(rawSections = []) {
  return SECTION_TEMPLATE.map((tpl) => {
    const existing = rawSections.find(
      (s) => tpl.match.test(String(s.title || s.sectionTitle || "")) || s.key === tpl.key
    );
    if (existing) {
      return {
        key: tpl.key,
        title: tpl.title,
        items: existing.items || existing.rows || [],
      };
    }
    return { key: tpl.key, title: tpl.title, items: [] };
  });
}

/* ═══════════════════════════════════════════
   DRAW TABLE SECTION
   ═══════════════════════════════════════════ */
function drawSectionTable(doc, section, startX) {
  const items = section.items || [];
  if (!items.length) return;

  const rowHeight = 22;
  const headerHeight = 26;

  // Check if we have space for at least the header + 2 rows
  const needed = headerHeight + rowHeight * Math.min(items.length, 3) + 30;
  if (doc.y + needed > doc.page.height - PAGE_MARGIN) {
    doc.addPage();
  }

  // Section title bar
  doc.save();
  doc.rect(startX, doc.y, TABLE_WIDTH, 24).fill(COLORS.slate);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.white);
  doc.text(`${section.key}. ${section.title}`, startX + 8, doc.y - 24 + 7, {
    width: TABLE_WIDTH - 16,
  });
  doc.restore();
  doc.y += 2;

  // Column headers
  const colKeys = ["srNo", "particular", "qty", "size", "rate", "amount", "remarks"];
  const colLabels = ["Sr.", "Particulars", "Qty", "Size", "Rate", "Amount", "Remarks"];

  let hx = startX;
  doc.save();
  doc.rect(startX, doc.y, TABLE_WIDTH, headerHeight).fill(COLORS.navy);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(COLORS.white);
  colKeys.forEach((key, i) => {
    doc.text(colLabels[i], hx + 4, doc.y - headerHeight + 8, {
      width: COL_WIDTHS[key] - 8,
      align: key === "amount" || key === "rate" || key === "qty" ? "right" : "left",
    });
    hx += COL_WIDTHS[key];
  });
  doc.restore();
  doc.y += 2;

  // Data rows
  let sectionTotal = 0;
  items.forEach((row, idx) => {
    // Page break if needed
    if (doc.y + rowHeight > doc.page.height - PAGE_MARGIN) {
      doc.addPage();
    }

    const bgColor = idx % 2 === 0 ? COLORS.white : COLORS.lightGray;
    doc.save();
    doc.rect(startX, doc.y, TABLE_WIDTH, rowHeight).fill(bgColor);

    // Draw cell borders
    let bx = startX;
    colKeys.forEach((key) => {
      doc.rect(bx, doc.y - rowHeight, COL_WIDTHS[key], rowHeight)
        .strokeColor(COLORS.border)
        .lineWidth(0.3)
        .stroke();
      bx += COL_WIDTHS[key];
    });

    doc.fontSize(8).font("Helvetica").fillColor(COLORS.text);
    let cx = startX;

    const qty = Number(row.quantity ?? row.qty ?? 0);
    const rate = Number(row.rate ?? 0);
    const amt = Number(row.amount ?? qty * rate);
    sectionTotal += amt;

    const values = [
      String(row.srNo ?? idx + 1),
      String(row.particular || row.particulars || ""),
      String(qty),
      String(row.size || row.sizes || ""),
      formatINR(rate),
      formatINR(amt),
      String(row.remarks || ""),
    ];

    colKeys.forEach((key, i) => {
      doc.text(values[i], cx + 4, doc.y - rowHeight + 6, {
        width: COL_WIDTHS[key] - 8,
        align: key === "amount" || key === "rate" || key === "qty" ? "right" : "left",
        lineBreak: false,
      });
      cx += COL_WIDTHS[key];
    });

    doc.restore();
  });

  // Section total row
  if (doc.y + rowHeight > doc.page.height - PAGE_MARGIN) {
    doc.addPage();
  }
  doc.save();
  doc.rect(startX, doc.y, TABLE_WIDTH, rowHeight).fill(COLORS.navy);
  doc.fontSize(9).font("Helvetica-Bold").fillColor(COLORS.white);
  doc.text("Section Total", startX + 8, doc.y - rowHeight + 6, {
    width: COL_WIDTHS.srNo + COL_WIDTHS.particular + COL_WIDTHS.qty + COL_WIDTHS.size + COL_WIDTHS.rate - 16,
  });
  doc.text(formatINR(sectionTotal), startX + COL_WIDTHS.srNo + COL_WIDTHS.particular + COL_WIDTHS.qty + COL_WIDTHS.size + COL_WIDTHS.rate + 4, doc.y - rowHeight + 6, {
    width: COL_WIDTHS.amount - 8,
    align: "right",
  });
  doc.restore();
  doc.y += 8;
}

/* ═══════════════════════════════════════════
   MAIN PDF GENERATOR
   ═══════════════════════════════════════════ */

/**
 * @param {Object} opts
 * @param {Object} opts.bill         — The primary bill document (populated)
 * @param {Array}  opts.allBills     — All bills for the same employee+event
 * @param {Object} [opts.event]      — The event document (populated)
 * @param {string} [opts.baseUrl]    — Server base URL for resolving relative image paths
 * @returns {Promise<Buffer>}        — PDF file buffer
 */
async function generateBillPdf({ bill, allBills = [], event, baseUrl = "" }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: PAGE_MARGIN,
        info: {
          Title: `Bill Sheet — ${bill.entityName || "Bill"}`,
          Author: "Event Management System",
        },
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const pageWidth = doc.page.width - PAGE_MARGIN * 2;
      const startX = PAGE_MARGIN;

      /* ── PAGE 1: HEADER ── */
      // Title bar
      doc.save();
      doc.rect(startX, doc.y, pageWidth, 42).fill(COLORS.navy);
      doc.fontSize(18).font("Helvetica-Bold").fillColor(COLORS.white);
      doc.text("BILL SHEET", startX + 16, doc.y - 42 + 12, { width: pageWidth - 32 });
      doc.restore();
      doc.y += 8;

      // Event info cards
      const ev = event || bill.event || {};
      const evName = ev.activityName || ev.name || "—";
      const evDate = fmtDate(ev.startDate || ev.date);
      const evVenue = ev.venue || "—";
      const evBudget = formatINR(ev.budget || 0);

      // Two-column info block
      const infoBlockH = 60;
      doc.save();
      doc.rect(startX, doc.y, pageWidth, infoBlockH)
        .fillColor(COLORS.lightGray).fill()
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();

      doc.fontSize(8).font("Helvetica-Bold").fillColor(COLORS.muted);
      doc.text("EVENT", startX + 12, doc.y - infoBlockH + 8);
      doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.text);
      doc.text(evName, startX + 12, doc.y - infoBlockH + 20, { width: pageWidth / 2 - 24 });

      doc.fontSize(8).font("Helvetica-Bold").fillColor(COLORS.muted);
      doc.text("VENDOR / ENTITY", startX + pageWidth / 2 + 12, doc.y - infoBlockH + 8);
      doc.fontSize(11).font("Helvetica-Bold").fillColor(COLORS.text);
      doc.text(bill.entityName || "—", startX + pageWidth / 2 + 12, doc.y - infoBlockH + 20, {
        width: pageWidth / 2 - 24,
      });

      doc.fontSize(8).font("Helvetica").fillColor(COLORS.muted);
      doc.text(`Date: ${evDate}  |  Venue: ${evVenue}  |  Budget: ${evBudget}`, startX + 12, doc.y - infoBlockH + 40, {
        width: pageWidth - 24,
      });
      doc.restore();
      doc.y += 10;

      // Bill meta row
      const contactName = bill.contactPerson?.name || bill.contactPerson?.email || "—";
      const status = String(bill.status || "pending").toUpperCase();
      const paidBy = String(bill.paidBy === "own" ? "self" : (bill.paidBy || "company")).toUpperCase();
      const category = String(bill.category || "—");

      doc.fontSize(8).font("Helvetica").fillColor(COLORS.muted);
      doc.text(
        `Contact: ${contactName}  |  Status: ${status}  |  Paid By: ${paidBy}  |  Category: ${category}  |  Amount: ${formatINR(bill.amount)}`,
        startX + 4,
        doc.y,
        { width: pageWidth - 8 }
      );
      doc.y += 16;

      // Separator
      doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();
      doc.y += 12;

      /* ── SECTIONS TABLE ── */
      const rawSheet = bill.billSheet || {};
      const rawSections = rawSheet.sections || [];
      const sections = resolveOrderedSections(rawSections);

      let grandTotal = 0;
      for (const sec of sections) {
        if (sec.items.length > 0) {
          drawSectionTable(doc, sec, startX);
          const secTotal = sec.items.reduce((sum, row) => {
            const qty = Number(row.quantity ?? row.qty ?? 0);
            const rate = Number(row.rate ?? 0);
            return sum + Number(row.amount ?? qty * rate);
          }, 0);
          grandTotal += secTotal;
        }
      }

      // Grand total
      if (grandTotal > 0 || rawSheet.grandTotal) {
        if (doc.y + 32 > doc.page.height - PAGE_MARGIN) doc.addPage();
        doc.y += 4;
        doc.save();
        doc.rect(startX, doc.y, TABLE_WIDTH, 28).fill(COLORS.accent);
        doc.fontSize(12).font("Helvetica-Bold").fillColor(COLORS.white);
        doc.text("GRAND TOTAL", startX + 12, doc.y - 28 + 8, { width: TABLE_WIDTH / 2 });
        doc.text(formatINR(rawSheet.grandTotal || grandTotal), startX + TABLE_WIDTH / 2, doc.y - 28 + 8, {
          width: TABLE_WIDTH / 2 - 12,
          align: "right",
        });
        doc.restore();
        doc.y += 14;
      }

      // If no sections had data, show the basic bill amount
      if (sections.every((s) => s.items.length === 0)) {
        doc.y += 8;
        doc.fontSize(10).font("Helvetica").fillColor(COLORS.text);
        doc.text(`Bill Amount: ${formatINR(bill.amount)}`, startX + 4, doc.y, {
          width: pageWidth - 8,
        });
        doc.y += 8;
        if (bill.description) {
          doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted);
          doc.text(`Description: ${bill.description}`, startX + 4, doc.y, {
            width: pageWidth - 8,
          });
          doc.y += 8;
        }
      }

      /* ── APPENDED VOUCHER IMAGES ── */
      // Collect all unique voucher URLs from the employee's bills for this event
      const voucherUrls = [];
      const seen = new Set();
      for (const b of allBills) {
        const vurl = String(b.voucherUrl || "").trim();
        if (vurl && !seen.has(vurl)) {
          seen.add(vurl);
          voucherUrls.push({ url: vurl, entityName: b.entityName || "Bill" });
        }
      }

      // Download and append images
      for (const { url: vUrl, entityName } of voucherUrls) {
        const imgBuf = await fetchImageBuffer(vUrl, baseUrl);
        if (!imgBuf || imgBuf.length < 100) continue;

        // Skip PDFs (pdfkit can't embed PDFs inside a PDF)
        const isPdf =
          imgBuf[0] === 0x25 &&
          imgBuf[1] === 0x50 &&
          imgBuf[2] === 0x44 &&
          imgBuf[3] === 0x46;
        if (isPdf) continue;

        doc.addPage();

        // Small label
        doc.fontSize(10).font("Helvetica-Bold").fillColor(COLORS.navy);
        doc.text(`📎 Voucher — ${entityName}`, startX, PAGE_MARGIN, {
          width: pageWidth,
        });
        doc.y += 8;

        try {
          const maxImgWidth = pageWidth;
          const maxImgHeight = doc.page.height - PAGE_MARGIN * 2 - 40;
          doc.image(imgBuf, startX, doc.y, {
            fit: [maxImgWidth, maxImgHeight],
            align: "center",
            valign: "top",
          });
        } catch (imgErr) {
          doc.fontSize(9).font("Helvetica").fillColor(COLORS.muted);
          doc.text(`(Could not embed image: ${imgErr.message})`, startX, doc.y);
        }
      }

      /* ── FOOTER on every page ── */
      const pageCount = doc.bufferedPageRange();
      for (let i = 0; i < pageCount.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font("Helvetica").fillColor(COLORS.muted);
        doc.text(
          `Generated on ${new Date().toLocaleDateString("en-IN")}  |  Page ${i + 1} of ${pageCount.count}`,
          PAGE_MARGIN,
          doc.page.height - 28,
          { width: doc.page.width - PAGE_MARGIN * 2, align: "center" }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateBillPdf };
