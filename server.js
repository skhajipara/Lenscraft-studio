require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const PDFDocument = require("pdfkit"); 

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("/data/uploads"));

// Configure Multer Storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = process.env.NODE_ENV === 'production' ? '/data/uploads' : './public/uploads';
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
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

/* ================= MONGODB CONNECTION & SCHEMAS ================= */

const bookingSchema = new mongoose.Schema({
  booking_id: String,
  name: String,
  phone: String,
  email: String,
  package: String,
  amount: String,
  paid_amount: { type: String, default: '0' },
  from_date: String,
  to_date: String,
  pincode: String,
  location: String,
  assigned_group: String,
  payment_status: { type: String, default: '' },
  payment_method: { type: String, default: '' },
  shoot_status: { type: String, default: 'Pending' }, // <-- NEW COLUMN
  calendar_event_id: String,
  created_at: { type: Date, default: Date.now }
});

const customQuoteSchema = new mongoose.Schema({
  name: String, email: String, phone: String, shoot_type: String, event_dates: String,
  location: String, services: String, budget: String, vision_link: String, notes: String,
  created_at: { type: Date, default: Date.now }
});

const gallerySchema = new mongoose.Schema({
  category: String, type: String, url: String, created_at: { type: Date, default: Date.now }
});

const packageSchema = new mongoose.Schema({
  category: String, title: String, price: Number, features: String, is_premium: { type: Number, default: 0 }
});

const staffGroupSchema = new mongoose.Schema({
  group_name: { type: String, unique: true }, email: String
});

// Helper to format Mongoose documents for the frontend
const formatDoc = (doc) => {
  const obj = doc.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

const Booking = mongoose.model('Booking', bookingSchema);
const CustomQuote = mongoose.model('CustomQuote', customQuoteSchema);
const Gallery = mongoose.model('Gallery', gallerySchema);
const Package = mongoose.model('Package', packageSchema);
const StaffGroup = mongoose.model('StaffGroup', staffGroupSchema);

// Connect to MongoDB & Seed Data
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("🟢 MongoDB Connected Successfully");

    // Auto-Seeder: Packages
    const packageCount = await Package.countDocuments();
    if (packageCount === 0) {
      console.log("Seeding default packages into MongoDB...");
      const defaultPkgs = [
        { category: 'wedding', title: 'Basic Wedding', price: 25000, features: '1 Traditional Photographer\n1 Traditional Videographer\nFull Ceremony Coverage\n10 Photo Editing\nStandard Highlight Video', is_premium: 0 },
        { category: 'wedding', title: 'Classic Wedding', price: 35000, features: '1 Traditional Photographer\n1 Videographer\nFull Event Coverage\n1 Instagram Reel\nSelected Photo Editing', is_premium: 0 },
        { category: 'wedding', title: 'Cinematic Wedding', price: 45000, features: '1 Candid Photographer\n1 Cinematic Videographer\nFull Wedding Coverage\n2 Instagram Reels\nSelected Photo Editing', is_premium: 0 },
        { category: 'wedding', title: 'Premium Wedding', price: 60000, features: 'DSLR Photography\n4K Cinematic Videography\n3 Instagram Reels\nSelected Photo Editing\nCloud Gallery Upload', is_premium: 1 },
        { category: 'wedding', title: 'Luxury Wedding', price: 80000, features: 'DSLR Candid Photographer\n4K Cinematic Video with Gimbal\nDrone Coverage\n4 Instagram Reels\nSelected Photo Editing\nCloud Gallery Upload', is_premium: 1 },
        { category: 'wedding', title: 'Royal Wedding', price: 100000, features: 'DSLR Photography Team\n4K Cinematic Film\n4K Drone Coverage\nSelected Photo Editing\nWedding Teaser + Full Film\nPremium Digital Photo Album', is_premium: 1 },
        { category: 'engagement', title: 'Ring Ceremony Basic', price: 15000, features: 'DSLR Photography\n1 Short Video\nFull Event Coverage\n15 Edited Photos', is_premium: 0 },
        { category: 'engagement', title: 'Classic Engagement', price: 25000, features: 'DSLR Photography\n4K Videography\nHighlight Video\nSelected Photos Editing\n1 Instagram Reel', is_premium: 0 },
        { category: 'engagement', title: 'Premium Engagement', price: 35000, features: 'Candid Photographer\nCinematic Videographer\n2 Instagram Reels\nSelected Photos Editing\nDigital Album', is_premium: 1 },
        { category: 'prewedding', title: 'Couple Portrait Shoot', price: 15000, features: 'Outdoor Photography\n2 Outfit Changes\n5 Photos Editing', is_premium: 0 },
        { category: 'prewedding', title: 'Story-Based Shoot', price: 20000, features: '1 Day Outdoor Shoot\nCandid Photography\n2-3 Outfit Changes\n15 Photos Editing', is_premium: 0 },
        { category: 'prewedding', title: 'Cinematic Love Story', price: 35000, features: 'Photography & Videography\nDrone Shots\n1 Minute Cinematic Trailer\nSelected Retouched Images', is_premium: 0 },
        { category: 'prewedding', title: 'Luxury Pre-Wedding', price: 50000, features: 'Multiple Locations\nCinematic Video Shoot\nDrone Coverage\nSelected Retouched Images', is_premium: 1 },
        { category: 'birthday', title: 'Birthday Basic', price: 8000, features: 'Event Photography\nCake Cutting Coverage', is_premium: 0 },
        { category: 'birthday', title: 'Birthday Celebration', price: 15000, features: 'Photography\nVideography\nFull Event Coverage', is_premium: 0 },
        { category: 'birthday', title: 'Birthday Premium', price: 25000, features: 'DSLR Photography\nHighlight Video\n1 Instagram Reel\nSelected Retouched Photos', is_premium: 1 },
        { category: 'baby', title: 'Standard Baby Shoot', price: 2000, features: '2 Hour Studio Session\n2 Theme Setups\n5 Photos Editing', is_premium: 0 },
        { category: 'baby', title: 'Creative Baby Shoot', price: 4000, features: '2-3 Theme Setups\nBaby + Family Photos\n10 Photos Editing', is_premium: 0 },
        { category: 'baby', title: 'Premium Baby Shoot', price: 6000, features: '3 Hour Studio Session\n3-4 Theme Setups\nFamily Photos Included\nSelected Retouched Photos', is_premium: 1 },
        { category: 'anniversary', title: 'Anniversary Basic', price: 10000, features: 'Event Photography\nCouple Portrait Session\n5 Edited Photos', is_premium: 0 },
        { category: 'anniversary', title: 'Anniversary Celebration', price: 18000, features: 'Photography & Videography\nFull Event Coverage\nHighlight Video', is_premium: 0 },
        { category: 'anniversary', title: 'Anniversary Premium', price: 30000, features: 'DSLR Photography\nCinematic Videography\n1 Instagram Reel\n10 Edited Photos', is_premium: 1 },
        { category: 'concert', title: 'Concert Basic', price: 20000, features: 'Stage Photography\nCrowd Coverage\nPerformance Highlights\nSelected Photos Edited', is_premium: 0 },
        { category: 'concert', title: 'Concert Event Coverage', price: 40000, features: 'Photography & Videography\nFull Show Coverage\nHighlight Video\nSelected Photos Edited', is_premium: 0 },
        { category: 'concert', title: 'Concert Cinematic', price: 60000, features: 'DSLR Photography\n4K Video Coverage\nDrone Shots\nEvent Highlight Film', is_premium: 1 },
        { category: 'corporate', title: 'Corporate Basic', price: 15000, features: 'Event Photography\nSpeaker Coverage\n10 Edited Photos', is_premium: 0 },
        { category: 'corporate', title: 'Corporate Professional', price: 30000, features: 'Photography & Videography\nFull Event Coverage\nHighlight Video', is_premium: 0 },
        { category: 'corporate', title: 'Corporate Premium', price: 50000, features: 'DSLR Photography\n4K Video Coverage\nPromotional Highlight Video\nSelected Edited Photos', is_premium: 1 },
        { category: 'fashion', title: 'Model Portfolio Basic', price: 10000, features: 'Indoor / Outdoor Shoot\n2 Outfit Changes\n10 Retouched Photos', is_premium: 0 },
        { category: 'fashion', title: 'Professional Portfolio', price: 18000, features: 'Fashion Photography\n3 Outfit Changes\n20 Retouched Photos', is_premium: 0 },
        { category: 'fashion', title: 'Fashion Premium', price: 30000, features: 'Professional Photography\nCinematic Video Reel\n4 Outfit Changes\nSelected Retouched Photos', is_premium: 1 },
        { category: 'religious', title: 'Traditional Event Coverage', price: 12000, features: 'Ritual Photography\nEvent Coverage\n5 Edited Photos', is_premium: 0 },
        { category: 'religious', title: 'Festival Coverage', price: 25000, features: 'Photography & Videography\nFull Event Coverage\nHighlight Video', is_premium: 0 },
        { category: 'religious', title: 'Premium Festival', price: 40000, features: 'DSLR Photography\n4K Video Coverage\nDrone Shots\nSelected Photos Edited', is_premium: 1 }
      ];
      await Package.insertMany(defaultPkgs);
    } else {
      console.log(`✅ Packages ready. Found ${packageCount} records.`);
    }

    // Auto-Seeder: Staff Groups
    const staffCount = await StaffGroup.countDocuments();
    if (staffCount === 0) {
      console.log("Seeding default staff groups...");
      const defaultGroups = [
        { group_name: 'Group 1', email: 'hajiparasarvesh@gmail.com' },
        { group_name: 'Group 2', email: 'sarveshhajipara@gmail.com' },
        { group_name: 'Group 3', email: '2305101020023@paruluniversity.ac.in' },
        { group_name: 'Group 4', email: 'ishagojariya@gmail.com' }
      ];
      await StaffGroup.insertMany(defaultGroups);
    } else {
      console.log(`✅ Staff groups ready. Found ${staffCount} records.`);
    }
  })
  .catch(err => console.log("Database connection error:", err));

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

    doc.save();
    doc.fillOpacity(0.04).strokeOpacity(0.04);
    
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

    doc.y = 50;
    doc.x = 40;

    doc.fillColor('#000000'); 
    doc.fontSize(20).font('Helvetica-Bold').text('LensCraft Studio', 0, doc.y, { align: 'center', width: doc.page.width });
    doc.fontSize(10).font('Helvetica').text('Premium Photography & Cinematography', { align: 'center', width: doc.page.width });
    doc.text('www.lenscraftstudio.com | +91 9978333844', { align: 'center', width: doc.page.width });
    
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica-Bold').text('Invoice', { align: 'center', width: doc.page.width, underline: true });
    doc.moveDown(0.2);
    doc.fontSize(10).font('Helvetica').text('Received Amout as Per Following', { align: 'center', width: doc.page.width });
    
    doc.moveDown(2);

    const startY = doc.y;
    
    doc.font('Helvetica-Bold').text('CLIENT NAME', 40, startY); doc.font('Helvetica').text(`: ${data.name.toUpperCase()}`, 160, startY);
    doc.font('Helvetica-Bold').text('CONTACT INFO', 40, startY + 15); doc.font('Helvetica').text(`: ${data.phone}`, 160, startY + 15);
    doc.font('Helvetica-Bold').text('EMAIL ADDRESS', 40, startY + 30); doc.font('Helvetica').text(`: ${data.email}`, 160, startY + 30);

    doc.font('Helvetica-Bold').text('RECEIPT NO.', 320, startY); doc.font('Helvetica').text(`: ${data.bookingId}`, 420, startY);
    doc.font('Helvetica-Bold').text('RECEIPT DATE', 320, startY + 15); doc.font('Helvetica').text(`: ${new Date().toLocaleDateString('en-IN')}`, 420, startY + 15);
    doc.font('Helvetica-Bold').text('CURRENCY', 320, startY + 30); doc.font('Helvetica').text(`: INR (Rupees)`, 420, startY + 30);

    doc.y = startY + 60; 
    doc.font('Helvetica').fontSize(9).fillColor('#666666').text(`Printed on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 40, doc.y);
    doc.moveDown(1);

    const tableTop = doc.y;
    doc.lineWidth(1).strokeColor('black');
    
    doc.rect(40, tableTop, 515, 20).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
    doc.text('Particular', 45, tableTop + 6);
    doc.text('Amount (Rs)', 400, tableTop + 6, { width: 150, align: 'right' });

    doc.rect(40, tableTop + 20, 515, 30).stroke(); 
    doc.font('Helvetica').fontSize(10);
    doc.text(`Package: ${data.package.toUpperCase()}`, 45, tableTop + 30);
    
    const totalNum = parseInt(String(data.amount).replace(/[^0-9]/g, '')) || 0;
    const paidNum = parseInt(String(data.paidAmount).replace(/[^0-9]/g, '')) || 0;
    const balanceNum = totalNum - paidNum;

    doc.text(`${totalNum.toLocaleString('en-IN')}`, 400, tableTop + 30, { width: 150, align: 'right' });

    const totalsY = tableTop + 50;
    doc.rect(40, totalsY, 515, 20).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Total Amount', 45, totalsY + 6);
    doc.text(`${totalNum.toLocaleString('en-IN')}`, 400, totalsY + 6, { width: 150, align: 'right' });

    doc.rect(40, totalsY + 20, 515, 20).stroke();
    doc.font('Helvetica');
    doc.text('Amount Paid', 45, totalsY + 26);
    doc.text(`${paidNum.toLocaleString('en-IN')}`, 400, totalsY + 26, { width: 150, align: 'right' });

    doc.rect(40, totalsY + 40, 515, 20).stroke();
    doc.font('Helvetica-Bold');
    doc.text('Balance Due', 45, totalsY + 46);
    doc.text(`${balanceNum.toLocaleString('en-IN')}`, 400, totalsY + 46, { width: 150, align: 'right' });

    doc.y = totalsY + 80;
    const payY = doc.y;
    doc.font('Helvetica-Bold').text('Pay. Mode', 40, payY); doc.font('Helvetica').text(`: ${data.paymentMethod || 'Online'}`, 130, payY);
    
    doc.font('Helvetica-Bold').text('Payment Status', 40, payY + 15); doc.font('Helvetica').text(`: ${data.paymentStatus.toUpperCase()}`, 130, payY + 15);

    const footerY = doc.page.height - 70;
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

app.get("/api/gallery", async (req, res) => {
  try {
    const rows = await Gallery.find().sort({ created_at: -1 });
    const formattedRows = rows.map(formatDoc);
    res.json({ status: "success", data: formattedRows });
  } catch (err) { res.json({ status: "error", data: [] }); }
});

app.get("/api/packages", async (req, res) => {
  try {
    const rows = await Package.find().sort({ category: 1, price: 1 });
    const formattedRows = rows.map(formatDoc);
    res.json({ status: "success", data: formattedRows });
  } catch (err) { res.json({ status: "error", data: [] }); }
});

app.post("/api/book", async (req, res) => {
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

  const finalizeBooking = async (assignedGroup) => {
    try {
      const newBooking = await Booking.create({
        booking_id: bookingId, name, phone, email, package: packageName, amount, from_date: from, to_date: to, pincode, location, assigned_group: assignedGroup, payment_status: '', payment_method: '', shoot_status: 'Pending'
      });
      
      const data = { bookingId, pincode, name, phone, email, package: packageName, amount, from, to, location, assignedGroup };
      const eventId = await createGoogleEvent(data);
      
      if (eventId) {
        await Booking.findByIdAndUpdate(newBooking._id, { calendar_event_id: eventId });
      }

      await transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject: `Booking Confirmed - LensCraft Studio [${bookingId}]`, html: clientTemplate(data) });
      await transporter.sendMail({ from: process.env.EMAIL_USER, to: process.env.EMAIL_USER, subject: `[${assignedGroup}] New Booking: ${packageName}`, html: adminTemplate(data) });

      const staffRow = await StaffGroup.findOne({ group_name: assignedGroup });
      if (staffRow && staffRow.email) {
        await transporter.sendMail({ from: process.env.EMAIL_USER, to: staffRow.email, subject: `New Shoot Assigned - [${bookingId}]`, html: staffTemplate(data) });
      }

      res.json({ status: "success" });
    } catch (error) {
      console.log("Error:", error);
      res.json({ status: "email_error" });
    }
  };

  try {
    const busyBookings = await Booking.find({ from_date: { $lt: to }, to_date: { $gt: from } });
    const busyGroups = busyBookings.map(r => r.assigned_group);
    const matchingShoot = busyBookings.find(r => r.pincode === pincode);

    if (matchingShoot) {
      finalizeBooking(matchingShoot.assigned_group);
    } else if (busyGroups.length >= 4) {
      return res.json({ status: "booked" }); 
    } else {
      const countRows = await Booking.aggregate([{ $group: { _id: "$assigned_group", total_shoots: { $sum: 1 } } }]);
      let countsMap = { 'Group 1': 0, 'Group 2': 0, 'Group 3': 0, 'Group 4': 0 };
      countRows.forEach(row => { if (countsMap[row._id] !== undefined) countsMap[row._id] = row.total_shoots; });
      let availableGroups = allGroups.filter(g => !busyGroups.includes(g));
      availableGroups.sort((a, b) => countsMap[a] - countsMap[b]);
      finalizeBooking(availableGroups[0]);
    }
  } catch(err) {
    res.json({ status: "error" });
  }
});

app.post("/api/custom-quote", async (req, res) => {
  const { name, email, phone, shootType, dates, location, services, budget, visionLink, notes } = req.body;
  if (!name || !email || !phone || !shootType || !dates || !location) return res.json({ status: "missing_fields" });

  try {
    await CustomQuote.create({ name, email, phone, shoot_type: shootType, event_dates: dates, location, services, budget, vision_link: visionLink, notes });
    const data = { name, email, phone, shootType, dates, location, services, budget, visionLink, notes };
    await transporter.sendMail({ from: process.env.EMAIL_USER, to: process.env.EMAIL_USER, subject: `New Custom Quote Request - ${name}`, html: customQuoteTemplate(data) });
    res.json({ status: "success" });
  } catch (error) { res.json({ status: "email_error" }); }
});

app.get("/api/stats", async (req, res) => {
  try {
    const totalClients = await Booking.countDocuments();
    const uniqueCitiesArr = await Booking.distinct('pincode');
    res.json({ totalClients: totalClients, uniqueCities: uniqueCitiesArr.length });
  } catch(err) {
    res.json({ totalClients: 0, uniqueCities: 0 });
  }
});

/* =======================================================
                 ADMIN PANEL APIs
======================================================= */

app.get("/api/admin/bookings", async (req, res) => {
  try {
    const rows = await Booking.find().sort({ created_at: -1 });
    const formattedRows = rows.map(formatDoc);
    res.json({ status: "success", data: formattedRows });
  } catch(err) { res.json({ status: "error", data: [] }); }
});

app.post("/api/admin/bookings", async (req, res) => {
  const { bookingId, name, phone, email, package: pkg, amount, from_date, to_date, pincode, location, assigned_group, payment_status, payment_method, shoot_status } = req.body;
  
  try {
    // --- NEW: Check for group time conflict ---
    if (assigned_group && assigned_group !== "") {
      const conflict = await Booking.findOne({
        assigned_group: assigned_group,
        from_date: { $lt: to_date },
        to_date: { $gt: from_date }
      });

      if (conflict) {
        return res.json({ status: "conflict", message: `${assigned_group} already has a shoot scheduled for this time period.` });
      }
    }
    // ------------------------------------------

    const newBooking = await Booking.create({ booking_id: bookingId, name, phone, email, package: pkg, amount, from_date, to_date, pincode, location, assigned_group, payment_status, payment_method, shoot_status: shoot_status || 'Pending' });
    const eventData = { bookingId, name, phone, package: pkg, from: from_date, to: to_date, location, assignedGroup: assigned_group };
    const eventId = await createGoogleEvent(eventData);
    if (eventId) {
      await Booking.findByIdAndUpdate(newBooking._id, { calendar_event_id: eventId });
    }
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.put("/api/admin/bookings/:id", async (req, res) => {
  const id = req.params.id;
  const newData = req.body;

  try {
    const oldData = await Booking.findById(id);
    if (!oldData) return res.json({ status: "error" });

    // --- NEW: Check for group time conflict ---
    if (newData.assigned_group && newData.assigned_group !== "") {
      const conflict = await Booking.findOne({
        _id: { $ne: id }, // Exclude current booking from the conflict check
        assigned_group: newData.assigned_group,
        from_date: { $lt: newData.to_date },
        to_date: { $gt: newData.from_date }
      });

      if (conflict) {
        return res.json({ status: "conflict", message: `Group ${newData.assigned_group} already has a shoot scheduled for this time period.` });
      }
    }
    // ------------------------------------------

    await Booking.findByIdAndUpdate(id, {
      booking_id: newData.bookingId, name: newData.name, phone: newData.phone, email: newData.email, package: newData.package, amount: newData.amount, paid_amount: newData.paid_amount, from_date: newData.from_date, to_date: newData.to_date, pincode: newData.pincode, location: newData.location, assigned_group: newData.assigned_group, payment_status: newData.payment_status, payment_method: newData.payment_method, shoot_status: newData.shoot_status || 'Pending'
    });

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
        const staffRow1 = await StaffGroup.findOne({ group_name: oldData.assigned_group });
        if (staffRow1 && staffRow1.email) transporter.sendMail({ from: process.env.EMAIL_USER, to: staffRow1.email, subject: `Shoot Cancelled - [${oldData.booking_id}]`, html: staffCancellationTemplate({...emailData, assignedGroup: oldData.assigned_group}) });
      }
      if (newData.assigned_group) {
        const staffRow2 = await StaffGroup.findOne({ group_name: newData.assigned_group });
        if (staffRow2 && staffRow2.email) transporter.sendMail({ from: process.env.EMAIL_USER, to: staffRow2.email, subject: `New Shoot Assigned - [${newData.bookingId}]`, html: staffTemplate({...emailData, assignedGroup: newData.assigned_group}) });
      }
    }

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
  } catch(err) { res.json({ status: "error" }); }
});

app.delete("/api/admin/bookings/:id", async (req, res) => {
  try {
    const row = await Booking.findById(req.params.id);
    if (!row) return res.json({ status: "error" });

    if (row.calendar_event_id) { 
      await deleteGoogleEvent(row.calendar_event_id); 
    }

    if (row.assigned_group) {
      const emailData = {
        bookingId: row.booking_id, name: row.name, phone: row.phone, package: row.package,
        from: row.from_date, to: row.to_date, location: row.location, assignedGroup: row.assigned_group
      };

      const staffRow = await StaffGroup.findOne({ group_name: row.assigned_group });
      if (staffRow && staffRow.email) {
        transporter.sendMail({ from: process.env.EMAIL_USER, to: staffRow.email, subject: `Shoot Cancelled/Deleted - [${row.booking_id}]`, html: staffCancellationTemplate(emailData) });
      }
    }

    await Booking.findByIdAndDelete(req.params.id);
    res.json({ status: "success" }); 
  } catch(err) { res.json({ status: "error" }); }
});

app.get("/api/admin/quotes", async (req, res) => {
  try {
    const rows = await CustomQuote.find().sort({ created_at: -1 });
    const formattedRows = rows.map(formatDoc);
    res.json({ status: "success", data: formattedRows });
  } catch(err) { res.json({ status: "error", data: [] }); }
});

app.put("/api/admin/quotes/:id", async (req, res) => {
  const { name, phone, email, shoot_type, event_dates, location, budget, services, vision_link, notes } = req.body;
  try {
    await CustomQuote.findByIdAndUpdate(req.params.id, { name, phone, email, shoot_type, event_dates, location, budget, services, vision_link, notes });
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.delete("/api/admin/quotes/:id", async (req, res) => {
  try {
    await CustomQuote.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.get("/api/admin/staff", async (req, res) => {
  try {
    const rows = await StaffGroup.find();
    const formattedRows = rows.map(formatDoc);
    res.json({ status: "success", data: formattedRows });
  } catch(err) { res.json({ status: "error", data: [] }); }
});

app.post("/api/admin/staff", async (req, res) => {
  try {
    await StaffGroup.create({ group_name: req.body.group_name, email: req.body.email });
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.put("/api/admin/staff/:id", async (req, res) => {
  try {
    await StaffGroup.findByIdAndUpdate(req.params.id, { group_name: req.body.group_name, email: req.body.email });
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.delete("/api/admin/staff/:id", async (req, res) => {
  try {
    await StaffGroup.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.post("/api/admin/packages", async (req, res) => {
  const { category, title, price, features, is_premium } = req.body;
  try {
    await Package.create({ category, title, price, features, is_premium });
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.put("/api/admin/packages/:id", async (req, res) => {
  const { category, title, price, features, is_premium } = req.body;
  try {
    await Package.findByIdAndUpdate(req.params.id, { category, title, price, features, is_premium });
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.delete("/api/admin/packages/:id", async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

// ADMIN GALLERY UPLOAD APIs
app.post("/api/admin/gallery", upload.single("media"), async (req, res) => {
  const { category, type } = req.body;
  if (!req.file) return res.json({ status: "error", message: "No file uploaded" });

  const fileUrl = `/uploads/${req.file.filename}`;
  try {
    await Gallery.create({ category, type, url: fileUrl });
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

app.delete("/api/admin/gallery/:id", async (req, res) => {
  try {
    const row = await Gallery.findById(req.params.id);
    if (row && row.url) {
      const filePath = path.join(__dirname, 'public', row.url);
      if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
    }
    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch(err) { res.json({ status: "error" }); }
});

// 👇 NEW: MANUAL DATABASE RELOAD API 👇
app.post("/api/admin/reload-database", async (req, res) => {
  try {
    let seeded = false;

    // Check & Seed Packages
    const packageCount = await Package.countDocuments();
    if (packageCount === 0) {
      const defaultPkgs = [
        { category: 'wedding', title: 'Basic Wedding', price: 25000, features: '1 Traditional Photographer\n1 Traditional Videographer\nFull Ceremony Coverage\n10 Photo Editing\nStandard Highlight Video', is_premium: 0 },
        { category: 'wedding', title: 'Classic Wedding', price: 35000, features: '1 Traditional Photographer\n1 Videographer\nFull Event Coverage\n1 Instagram Reel\nSelected Photo Editing', is_premium: 0 },
        { category: 'wedding', title: 'Cinematic Wedding', price: 45000, features: '1 Candid Photographer\n1 Cinematic Videographer\nFull Wedding Coverage\n2 Instagram Reels\nSelected Photo Editing', is_premium: 0 },
        { category: 'wedding', title: 'Premium Wedding', price: 60000, features: 'DSLR Photography\n4K Cinematic Videography\n3 Instagram Reels\nSelected Photo Editing\nCloud Gallery Upload', is_premium: 1 },
        { category: 'wedding', title: 'Luxury Wedding', price: 80000, features: 'DSLR Candid Photographer\n4K Cinematic Video with Gimbal\nDrone Coverage\n4 Instagram Reels\nSelected Photo Editing\nCloud Gallery Upload', is_premium: 1 },
        { category: 'wedding', title: 'Royal Wedding', price: 100000, features: 'DSLR Photography Team\n4K Cinematic Film\n4K Drone Coverage\nSelected Photo Editing\nWedding Teaser + Full Film\nPremium Digital Photo Album', is_premium: 1 },
        { category: 'engagement', title: 'Ring Ceremony Basic', price: 15000, features: 'DSLR Photography\n1 Short Video\nFull Event Coverage\n15 Edited Photos', is_premium: 0 },
        { category: 'engagement', title: 'Classic Engagement', price: 25000, features: 'DSLR Photography\n4K Videography\nHighlight Video\nSelected Photos Editing\n1 Instagram Reel', is_premium: 0 },
        { category: 'engagement', title: 'Premium Engagement', price: 35000, features: 'Candid Photographer\nCinematic Videographer\n2 Instagram Reels\nSelected Photos Editing\nDigital Album', is_premium: 1 },
        { category: 'prewedding', title: 'Couple Portrait Shoot', price: 15000, features: 'Outdoor Photography\n2 Outfit Changes\n5 Photos Editing', is_premium: 0 },
        { category: 'prewedding', title: 'Story-Based Shoot', price: 20000, features: '1 Day Outdoor Shoot\nCandid Photography\n2-3 Outfit Changes\n15 Photos Editing', is_premium: 0 },
        { category: 'prewedding', title: 'Cinematic Love Story', price: 35000, features: 'Photography & Videography\nDrone Shots\n1 Minute Cinematic Trailer\nSelected Retouched Images', is_premium: 0 },
        { category: 'prewedding', title: 'Luxury Pre-Wedding', price: 50000, features: 'Multiple Locations\nCinematic Video Shoot\nDrone Coverage\nSelected Retouched Images', is_premium: 1 },
        { category: 'birthday', title: 'Birthday Basic', price: 8000, features: 'Event Photography\nCake Cutting Coverage', is_premium: 0 },
        { category: 'birthday', title: 'Birthday Celebration', price: 15000, features: 'Photography\nVideography\nFull Event Coverage', is_premium: 0 },
        { category: 'birthday', title: 'Birthday Premium', price: 25000, features: 'DSLR Photography\nHighlight Video\n1 Instagram Reel\nSelected Retouched Photos', is_premium: 1 },
        { category: 'baby', title: 'Standard Baby Shoot', price: 2000, features: '2 Hour Studio Session\n2 Theme Setups\n5 Photos Editing', is_premium: 0 },
        { category: 'baby', title: 'Creative Baby Shoot', price: 4000, features: '2-3 Theme Setups\nBaby + Family Photos\n10 Photos Editing', is_premium: 0 },
        { category: 'baby', title: 'Premium Baby Shoot', price: 6000, features: '3 Hour Studio Session\n3-4 Theme Setups\nFamily Photos Included\nSelected Retouched Photos', is_premium: 1 },
        { category: 'anniversary', title: 'Anniversary Basic', price: 10000, features: 'Event Photography\nCouple Portrait Session\n5 Edited Photos', is_premium: 0 },
        { category: 'anniversary', title: 'Anniversary Celebration', price: 18000, features: 'Photography & Videography\nFull Event Coverage\nHighlight Video', is_premium: 0 },
        { category: 'anniversary', title: 'Anniversary Premium', price: 30000, features: 'DSLR Photography\nCinematic Videography\n1 Instagram Reel\n10 Edited Photos', is_premium: 1 },
        { category: 'concert', title: 'Concert Basic', price: 20000, features: 'Stage Photography\nCrowd Coverage\nPerformance Highlights\nSelected Photos Edited', is_premium: 0 },
        { category: 'concert', title: 'Concert Event Coverage', price: 40000, features: 'Photography & Videography\nFull Show Coverage\nHighlight Video\nSelected Photos Edited', is_premium: 0 },
        { category: 'concert', title: 'Concert Cinematic', price: 60000, features: 'DSLR Photography\n4K Video Coverage\nDrone Shots\nEvent Highlight Film', is_premium: 1 },
        { category: 'corporate', title: 'Corporate Basic', price: 15000, features: 'Event Photography\nSpeaker Coverage\n10 Edited Photos', is_premium: 0 },
        { category: 'corporate', title: 'Corporate Professional', price: 30000, features: 'Photography & Videography\nFull Event Coverage\nHighlight Video', is_premium: 0 },
        { category: 'corporate', title: 'Corporate Premium', price: 50000, features: 'DSLR Photography\n4K Video Coverage\nPromotional Highlight Video\nSelected Edited Photos', is_premium: 1 },
        { category: 'fashion', title: 'Model Portfolio Basic', price: 10000, features: 'Indoor / Outdoor Shoot\n2 Outfit Changes\n10 Retouched Photos', is_premium: 0 },
        { category: 'fashion', title: 'Professional Portfolio', price: 18000, features: 'Fashion Photography\n3 Outfit Changes\n20 Retouched Photos', is_premium: 0 },
        { category: 'fashion', title: 'Fashion Premium', price: 30000, features: 'Professional Photography\nCinematic Video Reel\n4 Outfit Changes\nSelected Retouched Photos', is_premium: 1 },
        { category: 'religious', title: 'Traditional Event Coverage', price: 12000, features: 'Ritual Photography\nEvent Coverage\n5 Edited Photos', is_premium: 0 },
        { category: 'religious', title: 'Festival Coverage', price: 25000, features: 'Photography & Videography\nFull Event Coverage\nHighlight Video', is_premium: 0 },
        { category: 'religious', title: 'Premium Festival', price: 40000, features: 'DSLR Photography\n4K Video Coverage\nDrone Shots\nSelected Photos Edited', is_premium: 1 }
      ];
      await Package.insertMany(defaultPkgs);
      seeded = true;
    }

    // Check & Seed Staff Groups
    const staffCount = await StaffGroup.countDocuments();
    if (staffCount === 0) {
      const defaultGroups = [
        { group_name: 'Group 1', email: 'hajiparasarvesh@gmail.com' },
        { group_name: 'Group 2', email: 'sarveshhajipara@gmail.com' },
        { group_name: 'Group 3', email: '2305101020023@paruluniversity.ac.in' },
        { group_name: 'Group 4', email: 'ishagojariya@gmail.com' }
      ];
      await StaffGroup.insertMany(defaultGroups);
      seeded = true;
    }

    if (seeded) {
      res.json({ status: "success", message: "Database re-seeded successfully." });
    } else {
      res.json({ status: "info", message: "Database is already fully populated." });
    }
  } catch(err) {
    console.error("Manual reload error:", err);
    res.json({ status: "error", message: "Failed to reload database." });
  }
});
// 👆 END NEW API 👆

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});