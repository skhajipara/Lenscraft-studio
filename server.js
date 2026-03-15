require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const PDFDocument = require("pdfkit"); 

// 👇 NEW: Required for Gallery Uploads
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("/data/uploads"));

// 👇 NEW: Configure Multer Storage for Gallery Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = '/data/uploads';
    // Create folder if it doesn't exist
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  }
});
const upload = multer({ storage: storage });

/* ================= AM/PM TIME FORMATTER ================= */
function formatAMPM(dateStr) {
  const d = new Date(dateStr);
  let hours = d.getHours();
  let minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  minutes = minutes.toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleString('default', { month: 'short' });
  const year = d.getFullYear();
  return `${year}-${d.getMonth() + 1}-${day} ${hours}:${minutes} ${ampm}`;
}

/* ================= MAIN BOOKING DATABASE ================= */
const db = new sqlite3.Database("/data/Lenscraft.db", (err) => {
  if (err) console.log("Database error:", err);
  else console.log("SQLite Main database connected");
});

db.serialize(() => {
  // Added calendar_event_id and paid_amount to the schema
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      package TEXT,
      amount TEXT,
      paid_amount TEXT DEFAULT '0',
      from_date TEXT,
      to_date TEXT,
      pincode TEXT,
      location TEXT,
      assigned_group TEXT,
      payment_status TEXT,
      payment_method TEXT,
      calendar_event_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // CLEVER FIX: Safely add columns to existing DB without deleting data!
  db.run(`ALTER TABLE bookings ADD COLUMN calendar_event_id TEXT`, (err) => { });
  db.run(`ALTER TABLE bookings ADD COLUMN paid_amount TEXT DEFAULT '0'`, (err) => { });

  db.run(`
    CREATE TABLE IF NOT EXISTS custom_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      shoot_type TEXT,
      event_dates TEXT,
      location TEXT,
      services TEXT,
      budget TEXT,
      vision_link TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 👇 NEW: GALLERY DATABASE TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      type TEXT,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // DYNAMIC PACKAGES TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      title TEXT,
      price INTEGER,
      features TEXT,
      is_premium INTEGER DEFAULT 0
    )
  `, () => {
    // AUTO-SEEDER: If packages table is empty, fill it with your exact current packages!
    db.get("SELECT COUNT(*) as count FROM packages", (err, row) => {
      if (row && row.count === 0) {
        console.log("Seeding default packages into database...");
        const defaultPkgs = [
          ['wedding', 'Basic Wedding', 25000, '1 Traditional Photographer\n1 Traditional Videographer\nFull Ceremony Coverage\n10 Photo Editing\nStandard Highlight Video', 0],
          ['wedding', 'Classic Wedding', 35000, '1 Traditional Photographer\n1 Videographer\nFull Event Coverage\n1 Instagram Reel\nSelected Photo Editing', 0],
          ['wedding', 'Cinematic Wedding', 45000, '1 Candid Photographer\n1 Cinematic Videographer\nFull Wedding Coverage\n2 Instagram Reels\nSelected Photo Editing', 0],
          ['wedding', 'Premium Wedding', 60000, 'DSLR Photography\n4K Cinematic Videography\n3 Instagram Reels\nSelected Photo Editing\nCloud Gallery Upload', 1],
          ['wedding', 'Luxury Wedding', 80000, 'DSLR Candid Photographer\n4K Cinematic Video with Gimbal\nDrone Coverage\n4 Instagram Reels\nSelected Photo Editing\nCloud Gallery Upload', 1],
          ['wedding', 'Royal Wedding', 100000, 'DSLR Photography Team\n4K Cinematic Film\n4K Drone Coverage\nSelected Photo Editing\nWedding Teaser + Full Film\nPremium Digital Photo Album', 1],
          ['engagement', 'Ring Ceremony Basic', 15000, 'DSLR Photography\n1 Short Video\nFull Event Coverage\n15 Edited Photos', 0],
          ['engagement', 'Classic Engagement', 25000, 'DSLR Photography\n4K Videography\nHighlight Video\nSelected Photos Editing\n1 Instagram Reel', 0],
          ['engagement', 'Premium Engagement', 35000, 'Candid Photographer\nCinematic Videographer\n2 Instagram Reels\nSelected Photos Editing\nDigital Album', 1],
          ['prewedding', 'Couple Portrait Shoot', 15000, 'Outdoor Photography\n2 Outfit Changes\n5 Photos Editing', 0],
          ['prewedding', 'Story-Based Shoot', 20000, '1 Day Outdoor Shoot\nCandid Photography\n2-3 Outfit Changes\n15 Photos Editing', 0],
          ['prewedding', 'Cinematic Love Story', 35000, 'Photography & Videography\nDrone Shots\n1 Minute Cinematic Trailer\nSelected Retouched Images', 0],
          ['prewedding', 'Luxury Pre-Wedding', 50000, 'Multiple Locations\nCinematic Video Shoot\nDrone Coverage\nSelected Retouched Images', 1],
          ['birthday', 'Birthday Basic', 8000, 'Event Photography\nCake Cutting Coverage', 0],
          ['birthday', 'Birthday Celebration', 15000, 'Photography\nVideography\nFull Event Coverage', 0],
          ['birthday', 'Birthday Premium', 25000, 'DSLR Photography\nHighlight Video\n1 Instagram Reel\nSelected Retouched Photos', 1],
          ['baby', 'Standard Baby Shoot', 2000, '2 Hour Studio Session\n2 Theme Setups\n5 Photos Editing', 0],
          ['baby', 'Creative Baby Shoot', 4000, '2-3 Theme Setups\nBaby + Family Photos\n10 Photos Editing', 0],
          ['baby', 'Premium Baby Shoot', 6000, '3 Hour Studio Session\n3-4 Theme Setups\nFamily Photos Included\nSelected Retouched Photos', 1],
          ['anniversary', 'Anniversary Basic', 10000, 'Event Photography\nCouple Portrait Session\n5 Edited Photos', 0],
          ['anniversary', 'Anniversary Celebration', 18000, 'Photography & Videography\nFull Event Coverage\nHighlight Video', 0],
          ['anniversary', 'Anniversary Premium', 30000, 'DSLR Photography\nCinematic Videography\n1 Instagram Reel\n10 Edited Photos', 1],
          ['concert', 'Concert Basic', 20000, 'Stage Photography\nCrowd Coverage\nPerformance Highlights\nSelected Photos Edited', 0],
          ['concert', 'Concert Event Coverage', 40000, 'Photography & Videography\nFull Show Coverage\nHighlight Video\nSelected Photos Edited', 0],
          ['concert', 'Concert Cinematic', 60000, 'DSLR Photography\n4K Video Coverage\nDrone Shots\nEvent Highlight Film', 1],
          ['corporate', 'Corporate Basic', 15000, 'Event Photography\nSpeaker Coverage\n10 Edited Photos', 0],
          ['corporate', 'Corporate Professional', 30000, 'Photography & Videography\nFull Event Coverage\nHighlight Video', 0],
          ['corporate', 'Corporate Premium', 50000, 'DSLR Photography\n4K Video Coverage\nPromotional Highlight Video\nSelected Edited Photos', 1],
          ['fashion', 'Model Portfolio Basic', 10000, 'Indoor / Outdoor Shoot\n2 Outfit Changes\n10 Retouched Photos', 0],
          ['fashion', 'Professional Portfolio', 18000, 'Fashion Photography\n3 Outfit Changes\n20 Retouched Photos', 0],
          ['fashion', 'Fashion Premium', 30000, 'Professional Photography\nCinematic Video Reel\n4 Outfit Changes\nSelected Retouched Photos', 1],
          ['religious', 'Traditional Event Coverage', 12000, 'Ritual Photography\nEvent Coverage\n5 Edited Photos', 0],
          ['religious', 'Festival Coverage', 25000, 'Photography & Videography\nFull Event Coverage\nHighlight Video', 0],
          ['religious', 'Premium Festival', 40000, 'DSLR Photography\n4K Video Coverage\nDrone Shots\nSelected Photos Edited', 1]
        ];
        const stmt = db.prepare(`INSERT INTO packages (category, title, price, features, is_premium) VALUES (?, ?, ?, ?, ?)`);
        defaultPkgs.forEach(p => stmt.run(p));
        stmt.finalize();
      }
    });
  });
});

/* ================= STAFF DATABASE ================= */
const staffDb = new sqlite3.Database("/data/LensCraft_Staff.db", (err) => {
  if (err) console.log("Staff DB error:", err);
  else console.log("SQLite Staff database connected");
});

staffDb.serialize(() => {
  staffDb.run(`
  CREATE TABLE IF NOT EXISTS staff_groups (
    group_name TEXT UNIQUE,
    email TEXT
  )`);

  const groups = [
    ['Group 1', 'hajiparasarvesh@gmail.com'],
    ['Group 2', 'sarveshhajipara@gmail.com'],
    ['Group 3', '2305101020023@paruluniversity.ac.in'],
    ['Group 4', 'ishagojariya@gmail.com']
  ];
  
  const stmt = staffDb.prepare(`INSERT OR IGNORE INTO staff_groups (group_name, email) VALUES (?, ?)`);
  groups.forEach(g => stmt.run(g));
  stmt.finalize();
});

const allGroups = ['Group 1', 'Group 2', 'Group 3', 'Group 4'];

/* ================= EMAIL SETUP ================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

/* ================= GOOGLE CALENDAR APIs ================= */
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n") : "",
  scopes: ["https://www.googleapis.com/auth/calendar"]
});
const calendar = google.calendar({ version: "v3", auth });

async function createGoogleEvent(data) {
  try {
    const event = {
      summary: `[${data.assignedGroup}] LensCraft - ${data.package}`,
      location: data.location,
      description: `Booking ID: ${data.bookingId}\nAssigned To: ${data.assignedGroup}\nClient Name: ${data.name}\nPhone: ${data.phone}\nPackage: ${data.package}`,
      start: { dateTime: new Date(data.from).toISOString(), timeZone: "Asia/Kolkata" },
      end: { dateTime: new Date(data.to).toISOString(), timeZone: "Asia/Kolkata" }
    };
    const response = await calendar.events.insert({ calendarId: "info.skgroup4@gmail.com", resource: event });
    console.log("Calendar event created!");
    return response.data.id; 
  } catch (error) {
    console.log("Google Calendar Error:", error.message);
    return null;
  }
}

// UPDATE Event Function
async function updateGoogleEvent(eventId, data) {
  if (!eventId) return; 
  try {
    const event = {
      summary: `[${data.assignedGroup}] LensCraft - ${data.package}`,
      location: data.location,
      description: `Booking ID: ${data.bookingId}\nAssigned To: ${data.assignedGroup}\nClient Name: ${data.name}\nPhone: ${data.phone}\nPackage: ${data.package}`,
      start: { dateTime: new Date(data.from).toISOString(), timeZone: "Asia/Kolkata" },
      end: { dateTime: new Date(data.to).toISOString(), timeZone: "Asia/Kolkata" }
    };
    await calendar.events.update({ calendarId: "info.skgroup4@gmail.com", eventId: eventId, resource: event });
    console.log("Calendar event updated!");
  } catch (error) {
    console.log("Google Calendar Update Error:", error.message);
  }
}

// DELETE Event Function
async function deleteGoogleEvent(eventId) {
  if (!eventId) return;
  try {
    await calendar.events.delete({ calendarId: "info.skgroup4@gmail.com", eventId: eventId });
    console.log("Calendar event deleted!");
  } catch (error) {
    console.log("Google Calendar Delete Error:", error.message);
  }
}

/* ================= PERFECT INVOICE PDF GENERATOR ================= */
function createInvoicePDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // --- 1. WATERMARK (Drawn first, behind everything) ---
    doc.save();
    doc.fillOpacity(0.04).strokeOpacity(0.04);
    
    // Exact Camera SVG Path
    doc.translate(177, 301).scale(10); 
    doc.lineWidth(1);
    doc.path('M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z').stroke();
    doc.circle(12, 13, 4).stroke();
    doc.circle(18, 10, 1).fill();
    doc.restore();

    doc.save();
    doc.fillColor('#000000').fillOpacity(0.04);
    doc.fontSize(60).font('Helvetica-Bold').text('LensCraft', 0, 560, { align: 'center', width: doc.page.width });
    doc.restore();

    // FORCE CURSOR BACK TO TOP
    doc.y = 50;
    doc.x = 40;

    // --- 2. HEADER ---
    doc.fillColor('#000000'); 
    doc.fontSize(20).font('Helvetica-Bold').text('LensCraft Studio', 0, doc.y, { align: 'center', width: doc.page.width });
    doc.fontSize(10).font('Helvetica').text('Premium Photography & Cinematography', { align: 'center', width: doc.page.width });
    doc.text('www.lenscraftstudio.com | +91 9978333844', { align: 'center', width: doc.page.width });
    
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica-Bold').text('Invoice', { align: 'center', width: doc.page.width, underline: true });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text('Received Amout as Per Following', { align: 'center', width: doc.page.width });
    
    doc.moveDown(2);

    // --- 3. TWO-COLUMN INFO TABLE ---
    const startY = doc.y;
    
    // Left Column
    doc.font('Helvetica-Bold').text('CLIENT NAME', 40, startY); doc.font('Helvetica').text(`: ${data.name.toUpperCase()}`, 160, startY);
    doc.font('Helvetica-Bold').text('CONTACT INFO', 40, startY + 15); doc.font('Helvetica').text(`: ${data.phone}`, 160, startY + 15);
    doc.font('Helvetica-Bold').text('EMAIL ADDRESS', 40, startY + 30); doc.font('Helvetica').text(`: ${data.email}`, 160, startY + 30);

    // Right Column
    doc.font('Helvetica-Bold').text('RECEIPT NO.', 320, startY); doc.font('Helvetica').text(`: ${data.bookingId}`, 420, startY);
    doc.font('Helvetica-Bold').text('RECEIPT DATE', 320, startY + 15); doc.font('Helvetica').text(`: ${new Date().toLocaleDateString('en-IN')}`, 420, startY + 15);
    doc.font('Helvetica-Bold').text('CURRENCY', 320, startY + 30); doc.font('Helvetica').text(`: INR (Rupees)`, 420, startY + 30);

    // Print Date
    doc.y = startY + 60; 
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(`Printed on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 40, doc.y);
    doc.moveDown(1);

    // --- 4. MAIN PRICING TABLE ---
    const tableTop = doc.y;
    doc.lineWidth(1).strokeColor('black');
    
    // Table Header Box
    doc.rect(40, tableTop, 515, 20).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
    doc.text('Particular', 45, tableTop + 6);
    doc.text('Amount (Rs)', 400, tableTop + 6, { width: 150, align: 'right' });

    // Table Content Box
    doc.rect(40, tableTop + 20, 515, 30).stroke(); 
    doc.font('Helvetica').fontSize(10);
    doc.text(`Package: ${data.package.toUpperCase()}`, 45, tableTop + 30);
    
    // Math logic
    const totalNum = parseInt(String(data.amount).replace(/[^0-9]/g, '')) || 0;
    const paidNum = parseInt(String(data.paidAmount).replace(/[^0-9]/g, '')) || 0;
    const balanceNum = totalNum - paidNum;

    doc.text(`${totalNum.toLocaleString('en-IN')}`, 400, tableTop + 30, { width: 150, align: 'right' });

    // Total Amount Row
    const totalsY = tableTop + 50;
    doc.rect(40, totalsY, 515, 20).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Total Amount', 45, totalsY + 6);
    doc.text(`${totalNum.toLocaleString('en-IN')}`, 400, totalsY + 6, { width: 150, align: 'right' });

    // Amount Paid Row
    doc.rect(40, totalsY + 20, 515, 20).stroke();
    doc.font('Helvetica');
    doc.text('Amount Paid', 45, totalsY + 26);
    doc.text(`${paidNum.toLocaleString('en-IN')}`, 400, totalsY + 26, { width: 150, align: 'right' });

    // Balance Due Row
    doc.rect(40, totalsY + 40, 515, 20).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Balance Due', 45, totalsY + 46);
    doc.text(`${balanceNum.toLocaleString('en-IN')}`, 400, totalsY + 46, { width: 150, align: 'right' });

    // --- 5. PAYMENT DETAILS ---
    doc.y = totalsY + 80;
    const payY = doc.y;
    doc.font('Helvetica-Bold').text('Pay. Mode', 40, payY); doc.font('Helvetica').text(`: ${data.paymentMethod || 'Online'}`, 130, payY);
    
    doc.font('Helvetica-Bold').text('Payment Status', 40, payY + 15); doc.font('Helvetica').text(`: ${data.paymentStatus.toUpperCase()}`, 130, payY + 15);

     // --- 6. FOOTER ---
     const footerY = doc.page.height - 70;

      // 👇 FIX: Added 'width: doc.page.width' so these perfectly align to center
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      doc.text('E. & O.E.', 0, footerY, { align: 'center', width: doc.page.width });
      doc.text('This is a computer-generated receipt.', 0, footerY + 15, { align: 'center', width: doc.page.width });
  
      doc.end();
   });
 }

/* ================= BASE EMAIL TEMPLATES ================= */
function baseEmailTemplate(title, preheader, contentBoxes) {
  return `
  <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" style="padding:20px 10px"><tr><td align="center">
  <table role="presentation" width="100%" style="max-width:550px;background-color:#ffffff;border-radius:16px;border:1px solid #e0e0e0;border-collapse:separate;border-spacing:0;overflow:hidden;">
  <tr><td style="background-color:#111111;padding:25px 20px;text-align:center;border-top-left-radius:15px;border-top-right-radius:15px;">
  <h2 style="color:#ffffff;margin:0;font-size:22px;">${title}</h2>
  ${preheader ? `<p style="color:#999999;margin:8px 0 0 0;font-size:14px;text-transform:uppercase;letter-spacing:1px;">${preheader}</p>` : ''}
  </td></tr>
  <tr><td style="padding:25px;color:#333333;font-size:14px;background-color:#ffffff;">
  ${contentBoxes}
  </td></tr>
  <tr><td style="background-color:#f3f4f6;padding:15px;text-align:center;border-bottom-left-radius:15px;border-bottom-right-radius:15px;">
  <p style="color:#374151;margin:0;font-size:12px;letter-spacing:0.5px;">
  © 2026 <strong>LensCraft Studio</strong>. All Rights Reserved.
  </p>  
  </td></tr>
  </table></td></tr></table></body></html>`;
}

function clientTemplate(data) {
  const boxes = `
    <p style="margin-top:0;">Hello <b>${data.name}</b>,</p>
    <p>Your booking request has been successfully received and securely saved.</p>
    <h3 style="color:#111111;font-size:18px;margin:25px 0 15px 0;border-bottom:1px solid #eeeeee;padding-bottom:10px;">Booking Summary</h3>
    <table role="presentation" width="100%" style="font-size:14px; text-align:left;">
    <tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;color:#666666;"><b>Booking ID</b></td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-weight:bold;color:#111111;">${data.bookingId}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;color:#666666;"><b>Package</b></td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-weight:bold;color:#111111;">${data.package}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;color:#666666;"><b>Amount</b></td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-weight:bold;color:#111111;">${data.amount}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;color:#666666;"><b>Start Time</b></td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">${formatAMPM(data.from)}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;color:#666666;"><b>End Time</b></td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">${formatAMPM(data.to)}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;color:#666666;"><b>Location</b></td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;">${data.location}</td></tr>
    </table>
    <p style="margin-top:25px;font-size:14px;color:#555555;">Our team will review your request and contact you shortly to finalize details.</p>`;
  return baseEmailTemplate("LensCraft Studio", "Booking Confirmation", boxes);
}

function adminTemplate(data) {
  const boxes = `
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;margin-bottom:20px;">
    <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Client Information</h3>
    <p style="margin:5px 0;"><b>Name:</b> ${data.name}</p>
    <p style="margin:5px 0;"><b>Email:</b> <a href="mailto:${data.email}" style="color:#111111;">${data.email}</a></p>
    <p style="margin:5px 0;"><b>Phone:</b> <a href="tel:${data.phone}" style="color:#111111;">${data.phone}</a></p>
    </div>
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;">
    <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Event Details</h3>
    <p style="margin:5px 0;"><b>Booking ID:</b> <span style="font-weight:bold;color:#111111;">${data.bookingId}</span></p>
    <p style="margin:5px 0;"><b>Package:</b> ${data.package}</p>
    <p style="margin:5px 0;"><b>Amount:</b> ${data.amount}</p>
    <p style="margin:5px 0;"><b>From:</b> ${formatAMPM(data.from)}</p>
    <p style="margin:5px 0;"><b>To:</b> ${formatAMPM(data.to)}</p>
    <p style="margin:5px 0;"><b>Pincode:</b> ${data.pincode}</p>
    <p style="margin:5px 0;"><b>Full Address:</b> ${data.location}</p>
    </div>`;
  return baseEmailTemplate("New Booking Alert", `Assigned To: <strong>${data.assignedGroup}</strong>`, boxes);
}

function staffTemplate(data) {
  const boxes = `
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;margin-bottom:20px;">
    <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Client Contact</h3>
    <p style="margin:5px 0;"><b>Name:</b> ${data.name}</p>
    <p style="margin:5px 0;"><b>Phone:</b> <a href="tel:${data.phone}" style="color:#111111;">${data.phone}</a></p>
    </div>
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;">
    <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Shoot Details</h3>
    <p style="margin:5px 0;"><b>Booking ID:</b> <span style="font-weight:bold;color:#111111;">${data.bookingId}</span></p>
    <p style="margin:5px 0;"><b>Package:</b> ${data.package}</p>
    <p style="margin:5px 0;"><b>Start Shoot Time:</b> ${formatAMPM(data.from)}</p>
    <p style="margin:5px 0;"><b>End Shoot Time:</b> ${formatAMPM(data.to)}</p>
    <p style="margin:5px 0;"><b>Pincode:</b> ${data.pincode}</p>
    <p style="margin:5px 0;"><b>Location:</b> ${data.location}</p>
    <p style="margin-top:15px;font-size:12px;color:#666666;">*Payment status will be updated by Admin.</p>
    </div>`;
  return baseEmailTemplate("SHOOT SCHEDULED", `Team: <strong>${data.assignedGroup}</strong>`, boxes);
}

function customQuoteTemplate(data) {
  const boxes = `
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;margin-bottom:20px;">
    <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Client Information</h3>
    <p style="margin:5px 0;"><b>Name:</b> ${data.name}</p>
    <p style="margin:5px 0;"><b>Email:</b> <a href="mailto:${data.email}" style="color:#111111;">${data.email}</a></p>
    <p style="margin:5px 0;"><b>Phone:</b> <a href="tel:${data.phone}" style="color:#111111;">${data.phone}</a></p>
    </div>
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;">
    <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Shoot Details</h3>
    <p style="margin:5px 0;"><b>Type:</b> ${data.shootType}</p>
    <p style="margin:5px 0;"><b>Dates:</b> ${data.dates}</p>
    <p style="margin:5px 0;"><b>Location:</b> ${data.location}</p>
    <p style="margin:5px 0;"><b>Budget:</b> ${data.budget || 'Not specified'}</p>
    <p style="margin:5px 0;"><b>Services:</b> ${data.services || 'None selected'}</p>
    <p style="margin:5px 0;"><b>Vision Link:</b> ${data.visionLink ? `<a href="${data.visionLink}" style="color:#111;">View Link</a>` : 'None'}</p>
    <p style="margin:5px 0;"><b>Notes:</b> ${data.notes || 'None'}</p>
    </div>`;
  return baseEmailTemplate("New Custom Quote Request", "LensCraft Studio", boxes);
}

function staffCancellationTemplate(data) {
  const boxes = `
    <div style="background:#fcfcfc;padding:15px;border-radius:8px;border-left:4px solid #333;margin-bottom:20px;">
      <h3 style="color:#111;font-size:16px;margin:0 0 10px 0;">Shoot Reassigned / Cancelled</h3>
      <p>The following shoot has been <b>removed</b> from your roster or reassigned to another team.</p>
      <p>You are no longer required for this event.</p>
    </div>
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;margin-bottom:20px;">
      <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Client Contact</h3>
      <p style="margin:5px 0;"><b>Name:</b> ${data.name}</p>
      <p style="margin:5px 0;"><b>Phone:</b> <a href="tel:${data.phone}" style="color:#111111;">${data.phone}</a></p>
    </div>
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111111;">
      <h3 style="color:#111111;font-size:16px;margin:0 0 10px 0;">Shoot Details</h3>
      <p style="margin:5px 0;"><b>Booking ID:</b> <span style="font-weight:bold;color:#111111;">${data.bookingId}</span></p>
      <p style="margin:5px 0;"><b>Package:</b> ${data.package}</p>
      <p style="margin:5px 0;"><b>Start Shoot Time:</b> ${formatAMPM(data.from)}</p>
      <p style="margin:5px 0;"><b>End Shoot Time:</b> ${formatAMPM(data.to)}</p>
      <p style="margin:5px 0;"><b>Location:</b> ${data.location}</p>
    </div>`;
  return baseEmailTemplate("SHOOT REMOVED", `Team: ${data.assignedGroup}`, boxes);
}

function paymentUpdateTemplate(data) {
  const boxes = `
    <div style="background:#f9f9f9;padding:15px;border-radius:8px;border-left:4px solid #111;">
      <h3 style="color:#111;font-size:16px;margin:0 0 10px 0;">Payment Status Updated</h3>
      <p>Hello <b>${data.name}</b>,</p>
      <p>We have updated the payment records for your booking (<b>${data.bookingId}</b>).</p>
      <p style="font-size: 16px; margin-top: 15px;">Status: <strong style="color:#111;">${data.paymentStatus.toUpperCase()}</strong></p>
      <p style="font-size: 16px;">Paid Amount: <strong>Rs. ${parseInt(data.paidAmount).toLocaleString('en-IN') || 0}</strong></p>
      <p style="margin-top:20px;font-size:13px;color:#666;">Please find your highly detailed, official invoice attached to this email.</p>
    </div>`;
  return baseEmailTemplate("Payment Receipt", "LensCraft Studio", boxes);
}

/* ================= PUBLIC APIs ================= */

// 👇 NEW: PUBLIC GALLERY API
app.get("/api/gallery", (req, res) => {
  db.all(`SELECT * FROM gallery ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.json({ status: "error", data: [] });
    res.json({ status: "success", data: rows });
  });
});

app.get("/api/packages", (req, res) => {
  db.all(`SELECT * FROM packages ORDER BY category, price ASC`, [], (err, rows) => {
    if (err) return res.json({ status: "error", data: [] });
    res.json({ status: "success", data: rows });
  });
});

app.post("/api/book", (req, res) => {
  const { bookingId, pincode, name, phone, email, packageName, amount, from, to, location } = req.body;

  if (!bookingId || !pincode || !name || !phone || !email || !from || !to || !location) {
    return res.json({ status: "missing_fields" });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const now = new Date();

  if (fromDate < now || toDate < now) return res.json({ status: "past_date" });
  if (fromDate.getTime() === toDate.getTime()) return res.json({ status: "same_time" });
  if (toDate < fromDate) return res.json({ status: "invalid_range" });

  const finalizeBooking = (assignedGroup) => {
    db.run(
      `INSERT INTO bookings (booking_id, name, phone, email, package, amount, from_date, to_date, pincode, location, assigned_group, payment_status, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')`,
      [bookingId, name, phone, email, packageName, amount, from, to, pincode, location, assignedGroup],
      async function(err) {
        if (err) return res.json({ status: "error" });
        const insertedDbId = this.lastID; 

        try {
          const data = { bookingId, pincode, name, phone, email, package: packageName, amount, from, to, location, assignedGroup };

          const eventId = await createGoogleEvent(data);
          if (eventId) {
            db.run(`UPDATE bookings SET calendar_event_id = ? WHERE id = ?`, [eventId, insertedDbId]);
          }

          await transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: `Booking Confirmed - LensCraft Studio [${bookingId}]`, html: clientTemplate(data) });
          await transporter.sendMail({ from: process.env.EMAIL_USER, to: process.env.EMAIL_USER, subject: `[${assignedGroup}] New Booking: ${packageName}`, html: adminTemplate(data) });

          staffDb.get(`SELECT email FROM staff_groups WHERE group_name = ?`, [assignedGroup], async (err, row) => {
            if (row && row.email) {
              await transporter.sendMail({ from: process.env.EMAIL_USER, to: row.email, subject: `New Shoot Assigned - [${bookingId}]`, html: staffTemplate(data) });
            }
          });

          res.json({ status: "success" });
        } catch (error) {
          console.log("Error:", error);
          res.json({ status: "email_error" });
        }
      }
    );
  };

  db.all(`SELECT assigned_group, pincode FROM bookings WHERE from_date < ? AND to_date > ?`, [to, from], (err, rows) => {
    if (err) return res.json({ status: "error" });
    const busyGroups = rows ? rows.map(r => r.assigned_group) : [];
    const matchingShoot = rows ? rows.find(r => r.pincode === pincode) : null;

    if (matchingShoot) {
      finalizeBooking(matchingShoot.assigned_group);
    } else if (busyGroups.length >= 4) {
      return res.json({ status: "booked" }); 
    } else {
      db.all(`SELECT assigned_group, COUNT(id) as total_shoots FROM bookings GROUP BY assigned_group`, [], (err, countRows) => {
        let countsMap = { 'Group 1': 0, 'Group 2': 0, 'Group 3': 0, 'Group 4': 0 };
        if (countRows) countRows.forEach(row => { if (countsMap[row.assigned_group] !== undefined) countsMap[row.assigned_group] = row.total_shoots; });
        let availableGroups = allGroups.filter(g => !busyGroups.includes(g));
        availableGroups.sort((a, b) => countsMap[a] - countsMap[b]);
        finalizeBooking(availableGroups[0]);
      });
    }
  });
});

app.post("/api/custom-quote", (req, res) => {
  const { name, email, phone, shootType, dates, location, services, budget, visionLink, notes } = req.body;
  if (!name || !email || !phone || !shootType || !dates || !location) return res.json({ status: "missing_fields" });

  db.run(
    `INSERT INTO custom_quotes (name, email, phone, shoot_type, event_dates, location, services, budget, vision_link, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    // 👇 THE FIX: Changed 'vision_link' to 'visionLink' in the array below
    [name, email, phone, shootType, dates, location, services, budget, visionLink, notes],
    async function(err) {
      if (err) return res.json({ status: "error" });
      try {
        const data = { name, email, phone, shootType, dates, location, services, budget, visionLink, notes };
        await transporter.sendMail({ from: process.env.EMAIL_USER, to: process.env.EMAIL_USER, subject: `New Custom Quote Request - ${name}`, html: customQuoteTemplate(data) });
        res.json({ status: "success" });
      } catch (error) { res.json({ status: "email_error" }); }
    }
  );
});

app.get("/api/stats", (req, res) => {
  db.get(`SELECT COUNT(id) as totalClients, COUNT(DISTINCT pincode) as uniqueCities FROM bookings`, (err, row) => {
    if (err) return res.json({ totalClients: 0, uniqueCities: 0 }); 
    res.json({ totalClients: row.totalClients, uniqueCities: row.uniqueCities });
  });
});

/* =======================================================
                 ADMIN PANEL APIs
======================================================= */

// 1. GET ALL BOOKINGS
app.get("/api/admin/bookings", (req, res) => {
  db.all(`SELECT * FROM bookings ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.json({ status: "error", data: [] });
    res.json({ status: "success", data: rows });
  });
});

// 2. ADD MANUAL BOOKING
app.post("/api/admin/bookings", (req, res) => {
  const { bookingId, name, phone, email, package: pkg, amount, from_date, to_date, pincode, location, assigned_group, payment_status, payment_method } = req.body;
  
  db.run(
    `INSERT INTO bookings (booking_id, name, phone, email, package, amount, from_date, to_date, pincode, location, assigned_group, payment_status, payment_method) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [bookingId, name, phone, email, pkg, amount, from_date, to_date, pincode, location, assigned_group, payment_status, payment_method],
    async function(err) {
      if (err) return res.json({ status: "error" });
      const insertedDbId = this.lastID;
      
      const eventData = { bookingId, name, phone, package: pkg, from: from_date, to: to_date, location, assignedGroup: assigned_group };
      const eventId = await createGoogleEvent(eventData);
      if (eventId) {
        db.run(`UPDATE bookings SET calendar_event_id = ? WHERE id = ?`, [eventId, insertedDbId]);
      }
      res.json({ status: "success" });
    }
  );
});

// 3. EDIT BOOKING
app.put("/api/admin/bookings/:id", (req, res) => {
  const id = req.params.id;
  const newData = req.body;

  db.get(`SELECT * FROM bookings WHERE id = ?`, [id], (err, oldData) => {
    if (err || !oldData) return res.json({ status: "error" });

    db.run(
      `UPDATE bookings SET booking_id=?, name=?, phone=?, email=?, package=?, amount=?, paid_amount=?, from_date=?, to_date=?, pincode=?, location=?, assigned_group=?, payment_status=?, payment_method=? WHERE id=?`,
      [newData.bookingId, newData.name, newData.phone, newData.email, newData.package, newData.amount, newData.paid_amount, newData.from_date, newData.to_date, newData.pincode, newData.location, newData.assigned_group, newData.payment_status, newData.payment_method, id],
      async (err) => {
        if (err) return res.json({ status: "error" });

        const emailData = { 
          bookingId: newData.bookingId, name: newData.name, phone: newData.phone, email: newData.email, 
          package: newData.package, amount: newData.amount, paidAmount: newData.paid_amount,
          from: newData.from_date, to: newData.to_date, location: newData.location, assignedGroup: newData.assigned_group 
        };

        if (oldData.calendar_event_id) {
          const calData = { ...emailData, assignedGroup: newData.assigned_group };
          await updateGoogleEvent(oldData.calendar_event_id, calData);
        }

        if (oldData.assigned_group !== newData.assigned_group) {
          if (oldData.assigned_group) {
            staffDb.get(`SELECT email FROM staff_groups WHERE group_name = ?`, [oldData.assigned_group], (err, row) => {
              if (row && row.email) transporter.sendMail({ from: process.env.EMAIL_USER, to: row.email, subject: `Shoot Cancelled - [${oldData.booking_id}]`, html: staffCancellationTemplate({...emailData, assignedGroup: oldData.assigned_group}) });
            });
          }
          if (newData.assigned_group) {
            staffDb.get(`SELECT email FROM staff_groups WHERE group_name = ?`, [newData.assigned_group], (err, row) => {
              if (row && row.email) transporter.sendMail({ from: process.env.EMAIL_USER, to: row.email, subject: `New Shoot Assigned - [${newData.bookingId}]`, html: staffTemplate({...emailData, assignedGroup: newData.assigned_group}) });
            });
          }
        }

        // 👇 THE FIX: Removed the "Pending" restriction so it emails on all status changes
        if (oldData.payment_status !== newData.payment_status && newData.payment_status !== "") {
          const invoiceData = { 
            ...emailData, 
            paymentStatus: newData.payment_status, 
            paymentMethod: newData.payment_method
          };
          
          const pdfBuffer = await createInvoicePDF(invoiceData);
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: newData.email,
            subject: `Payment Receipt & Invoice - LensCraft Studio [${newData.bookingId}]`,
            html: paymentUpdateTemplate(invoiceData),
            attachments: [{ filename: `LensCraft_Invoice_${newData.bookingId}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
          });
        }
        res.json({ status: "success" });
      }
    );
  });
});

app.delete("/api/admin/bookings/:id", (req, res) => {
  // 1. Fetch ALL data for this booking before deleting
  db.get("SELECT * FROM bookings WHERE id=?", [req.params.id], async (err, row) => {
    if (err || !row) return res.json({ status: "error" });

    // 2. Delete Google Calendar Event if it exists
    if (row.calendar_event_id) { 
      await deleteGoogleEvent(row.calendar_event_id); 
    }

    // 3. Prepare data and send cancellation email to the assigned staff group
    if (row.assigned_group) {
      const emailData = {
        bookingId: row.booking_id,
        name: row.name,
        phone: row.phone,
        package: row.package,
        from: row.from_date,
        to: row.to_date,
        location: row.location,
        assignedGroup: row.assigned_group
      };

      staffDb.get(`SELECT email FROM staff_groups WHERE group_name = ?`, [row.assigned_group], (err, staffRow) => {
        if (staffRow && staffRow.email) {
          transporter.sendMail({ 
            from: process.env.EMAIL_USER, 
            to: staffRow.email, 
            subject: `Shoot Cancelled/Deleted - [${row.booking_id}]`, 
            html: staffCancellationTemplate(emailData) 
          });
        }
      });
    }

    // 4. Finally, delete the record from the database
    db.run(`DELETE FROM bookings WHERE id=?`, [req.params.id], (err) => { 
      res.json({ status: "success" }); 
    });
  });
});

app.get("/api/admin/quotes", (req, res) => {
  db.all(`SELECT * FROM custom_quotes ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.json({ status: "error", data: [] });
    res.json({ status: "success", data: rows });
  });
});

app.put("/api/admin/quotes/:id", (req, res) => {
  const { name, phone, email, shoot_type, event_dates, location, budget, services, vision_link, notes } = req.body;
  db.run(
    `UPDATE custom_quotes SET name=?, phone=?, email=?, shoot_type=?, event_dates=?, location=?, budget=?, services=?, vision_link=?, notes=? WHERE id=?`,
    [name, phone, email, shoot_type, event_dates, location, budget, services, vision_link, notes, req.params.id],
    (err) => { res.json({ status: "success" }); }
  );
});

app.delete("/api/admin/quotes/:id", (req, res) => {
  db.run(`DELETE FROM custom_quotes WHERE id=?`, [req.params.id], (err) => { res.json({ status: "success" }); });
});

app.get("/api/admin/staff", (req, res) => {
  staffDb.all(`SELECT rowid as id, group_name, email FROM staff_groups`, [], (err, rows) => {
    if (err) return res.json({ status: "error" });
    res.json({ status: "success", data: rows });
  });
});

app.post("/api/admin/staff", (req, res) => {
  staffDb.run(`INSERT INTO staff_groups (group_name, email) VALUES (?, ?)`, [req.body.group_name, req.body.email], (err) => {
    res.json({ status: "success" });
  });
});

app.put("/api/admin/staff/:id", (req, res) => {
  staffDb.run(`UPDATE staff_groups SET group_name=?, email=? WHERE rowid=?`, [req.body.group_name, req.body.email, req.params.id], (err) => {
    res.json({ status: "success" });
  });
});

app.delete("/api/admin/staff/:id", (req, res) => {
  staffDb.run(`DELETE FROM staff_groups WHERE rowid=?`, [req.params.id], (err) => {
    res.json({ status: "success" });
  });
});

app.post("/api/admin/packages", (req, res) => {
  const { category, title, price, features, is_premium } = req.body;
  db.run(`INSERT INTO packages (category, title, price, features, is_premium) VALUES (?, ?, ?, ?, ?)`, [category, title, price, features, is_premium], (err) => {
    res.json({ status: "success" });
  });
});

app.put("/api/admin/packages/:id", (req, res) => {
  const { category, title, price, features, is_premium } = req.body;
  db.run(`UPDATE packages SET category=?, title=?, price=?, features=?, is_premium=? WHERE id=?`, [category, title, price, features, is_premium, req.params.id], (err) => {
    res.json({ status: "success" });
  });
});

app.delete("/api/admin/packages/:id", (req, res) => {
  db.run(`DELETE FROM packages WHERE id=?`, [req.params.id], (err) => {
    res.json({ status: "success" });
  });
});

// 👇 NEW: ADMIN GALLERY UPLOAD APIs
app.post("/api/admin/gallery", upload.single("media"), (req, res) => {
  const { category, type } = req.body;
  if (!req.file) return res.json({ status: "error", message: "No file uploaded" });

  const fileUrl = `/uploads/${req.file.filename}`;
  db.run(`INSERT INTO gallery (category, type, url) VALUES (?, ?, ?)`, [category, type, fileUrl], (err) => {
    if (err) return res.json({ status: "error" });
    res.json({ status: "success" });
  });
});

app.delete("/api/admin/gallery/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT url FROM gallery WHERE id = ?", [id], (err, row) => {
    if (row && row.url) {
      const filePath = path.join(__dirname, 'public', row.url);
      if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); } // Delete actual file from hard drive
    }
    db.run("DELETE FROM gallery WHERE id = ?", [id], (err) => {
      res.json({ status: "success" });
    });
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});