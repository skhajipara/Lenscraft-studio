# 📷 LensCraft Studio - Photography Management Platform

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)

LensCraft Studio is a comprehensive, full-stack web application designed specifically for photography and cinematography businesses. It serves as both a client-facing portfolio and a powerful backend Content Management System (CMS) to automate bookings, invoicing, scheduling, and staff routing.

## 📑 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Core Architecture](#-core-architecture)
- [Security & Storage](#-security--storage)

---

## ✨ Features

### 👤 Client-Facing Application
* **Dynamic Portfolio:** A responsive gallery supporting both high-res images and 4K video reels with custom media controls.
* **Live Service Packages:** Real-time pricing and package inclusions fetched directly from the MongoDB database.
* **Custom Quote Generator:** An advanced form allowing clients to request tailored coverage based on event type, deliverables, and budget.
* **Smart Booking Engine:** Clients can book dates, and the system algorithmically assigns an available photography team based on active rosters, utilizing **strict time-conflict resolution**.

### 🛡️ Admin & Automation Dashboard
* **Intelligent Conflict Alerts:** Full-stack validation prevents admins from double-booking staff groups for overlapping timeframes, featuring custom center-screen UI alerts.
* **Shoot Status Tracking:** Granular control over event lifecycles, allowing admins to track shoots as 'Pending' or 'Done' directly from the dashboard.
* **Live Database Seeding:** A secure, one-click "Reload Database" API to instantly synchronize default packages and staff groups without requiring a server reboot.
* **Google Calendar Integration:** Automatically creates, updates, and deletes calendar events for the studio when bookings are modified.
* **Automated PDF Invoicing:** Generates precise, beautifully branded PDF receipts using `PDFKit` instantly upon payment status changes.
* **Email Notification System:** Uses `Nodemailer` to automatically route customized HTML emails to clients (confirmations, invoices) and staff (shoot assignments, cancellations).
* **Media Management:** Securely upload and delete gallery media directly from the admin panel using `Multer`.

---

## 🛠️ Tech Stack

**Frontend:**
- HTML5, CSS3, Vanilla JavaScript
- Responsive CSS Grid & Flexbox layouts
- SessionStorage for Secure Admin Authentication

**Backend:**
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Atlas) with Mongoose ODM
- **File Uploads:** Multer
- **Email Delivery:** Nodemailer
- **PDF Generation:** PDFKit
- **External APIs:** Google APIs (Google Calendar v3)
- **Deployment:** Render Web Services

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites
* [Node.js](https://nodejs.org/) (v14.0 or higher)
* npm (Node Package Manager)
* A [MongoDB Atlas](https://www.mongodb.com/atlas) Cluster

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/skhajipara/Lenscraft-studio.git](https://github.com/skhajipara/Lenscraft-studio.git)
   cd lenscraft-studio
