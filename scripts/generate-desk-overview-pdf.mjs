import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "docs", "DESK_OVERVIEW_TH.md");
const outPath = path.join(root, "docs", "BTC-Short-Premium-Agent-Desk-Overview.pdf");

const raw = fs.readFileSync(mdPath, "utf8");
const lines = raw.split(/\r?\n/);

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  info: {
    Title: "BTC Short Premium Agent — Desk Overview",
    Author: "Trading Desk Documentation",
  },
});

const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

function ensureSpace(h = 40) {
  if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith("---") && i < 5) continue;
  if (line.trim() === "---") {
    ensureSpace(20);
    doc.moveDown(0.5);
    continue;
  }

  if (line.startsWith("# ")) {
    ensureSpace(60);
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#047857");
    doc.text(line.slice(2).trim(), { width: pageWidth });
    doc.moveDown(0.5);
    doc.fillColor("#000000");
    continue;
  }

  if (line.startsWith("## ")) {
    ensureSpace(50);
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#047857");
    doc.text(line.slice(3).trim(), { width: pageWidth });
    doc.moveDown(0.3);
    doc.fillColor("#000000");
    continue;
  }

  if (line.startsWith("|") && line.includes("---")) continue;

  if (line.startsWith("|")) {
    doc.font("Helvetica").fontSize(9);
    const cells = line.split("|").filter((c) => c.trim());
    doc.text(cells.map((c) => c.trim()).join("  ·  "), { width: pageWidth });
    continue;
  }

  if (line.startsWith("```")) {
    const block = [];
    i++;
    while (i < lines.length && !lines[i].startsWith("```")) {
      block.push(lines[i]);
      i++;
    }
    ensureSpace(block.length * 12 + 20);
    doc.font("Courier").fontSize(8).fillColor("#333333");
    doc.text(block.join("\n"), { width: pageWidth });
    doc.fillColor("#000000");
    doc.moveDown(0.3);
    continue;
  }

  if (line.startsWith("*") && line.endsWith("*")) {
    ensureSpace(30);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#666666");
    doc.text(line.replace(/\*/g, "").trim(), { width: pageWidth });
    doc.fillColor("#000000");
    continue;
  }

  if (line.trim() === "") {
    doc.moveDown(0.25);
    continue;
  }

  ensureSpace(20);
  doc.font("Helvetica").fontSize(10);
  const text = line.replace(/\*\*/g, "").replace(/\*/g, "");
  doc.text(text, { width: pageWidth });
}

await new Promise((resolve, reject) => {
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  stream.on("finish", resolve);
  stream.on("error", reject);
  doc.on("error", reject);
  doc.end();
});

console.log(`PDF written: ${outPath}`);
