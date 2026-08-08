import type { Prisma } from "@prisma/client";
import type { Response } from "express";
import PDFDocument from "pdfkit";

export type ChallanInvoiceData = Prisma.SalesChallanGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        name: true;
        mobile: true;
        businessName: true;
        address: true;
      };
    };
    createdBy: {
      select: {
        id: true;
        name: true;
        email: true;
        role: true;
      };
    };
    items: {
      orderBy: { id: "asc" };
    };
  };
}>;

export function generateInvoicePdf(challan: ChallanInvoiceData, res: Response): void {
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  doc.pipe(res);

  // Header Section
  doc
    .fillColor("#0f172a")
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("Mini ERP + CRM — Sales Invoice", { align: "left" });

  doc
    .fillColor("#64748b")
    .fontSize(10)
    .font("Helvetica")
    .text("Wholesale Back-Office Operations Portal", { align: "left" });

  doc.moveDown(0.5);
  doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(1);

  // Meta Section: Invoice & Customer Info side-by-side
  const metaY = doc.y;

  // Invoice Details (Left Column)
  doc
    .fillColor("#0f172a")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Invoice Details", 40, metaY);

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#334155")
    .text(`Challan Number: ${challan.challanNumber}`, 40, metaY + 18)
    .text(`Date: ${new Date(challan.createdAt).toISOString().split("T")[0]}`, 40, metaY + 32)
    .text(`Status: ${challan.status}`, 40, metaY + 46);

  // Customer Details (Right Column)
  doc
    .fillColor("#0f172a")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Customer Information", 300, metaY);

  const customerName = challan.customer?.name || "N/A";
  const businessName = challan.customer?.businessName || "-";
  const mobile = challan.customer?.mobile || "-";
  const address = challan.customer?.address || "-";

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#334155")
    .text(`Name: ${customerName}`, 300, metaY + 18)
    .text(`Business: ${businessName}`, 300, metaY + 32)
    .text(`Mobile: ${mobile}`, 300, metaY + 46)
    .text(`Address: ${address}`, 300, metaY + 60, { width: 250 });

  const startTableY = Math.max(doc.y, metaY + 85) + 15;

  // Table Header
  doc
    .rect(40, startTableY, 515, 22)
    .fill("#f1f5f9");

  doc
    .fillColor("#0f172a")
    .fontSize(9)
    .font("Helvetica-Bold")
    .text("Product Name", 45, startTableY + 6, { width: 170 })
    .text("SKU", 220, startTableY + 6, { width: 100 })
    .text("Qty", 325, startTableY + 6, { width: 50, align: "right" })
    .text("Unit Price (₹)", 385, startTableY + 6, { width: 80, align: "right" })
    .text("Line Total (₹)", 470, startTableY + 6, { width: 80, align: "right" });

  let currentY = startTableY + 25;
  let grandTotal = 0;

  challan.items.forEach((item, index) => {
    const unitPrice = Number(item.unitPriceSnapshot);
    const lineTotal = item.quantity * unitPrice;
    grandTotal += lineTotal;

    // Alternate background row color
    if (index % 2 === 1) {
      doc.rect(40, currentY - 2, 515, 20).fill("#f8fafc");
    }

    doc
      .fillColor("#334155")
      .fontSize(9)
      .font("Helvetica")
      .text(item.productNameSnapshot, 45, currentY, { width: 170 })
      .text(item.skuSnapshot, 220, currentY, { width: 100 })
      .text(String(item.quantity), 325, currentY, { width: 50, align: "right" })
      .text(unitPrice.toFixed(2), 385, currentY, { width: 80, align: "right" })
      .text(lineTotal.toFixed(2), 470, currentY, { width: 80, align: "right" });

    currentY += 20;
  });

  // Table Divider Line
  doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(40, currentY + 5).lineTo(555, currentY + 5).stroke();

  // Grand Total Box
  const totalY = currentY + 15;
  doc
    .rect(350, totalY, 205, 30)
    .fill("#e2e8f0");

  doc
    .fillColor("#0f172a")
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Grand Total:", 360, totalY + 8)
    .text(`₹${grandTotal.toFixed(2)}`, 450, totalY + 8, { width: 100, align: "right" });

  // Footer Note
  doc
    .fillColor("#94a3b8")
    .fontSize(8)
    .font("Helvetica")
    .text("Thank you for your business! Mini ERP + CRM System Generated Invoice.", 40, 780, { align: "center", width: 515 });

  doc.end();
}
