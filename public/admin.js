/* =========================================================
   LENSCRAFT PRO ADMIN DASHBOARD SCRIPT (B&W THEME)
========================================================= */

window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('preloader').classList.add('preloader-hidden');
    setTimeout(() => {
      
      // 👇 NEW: Check if already logged in during this session
      if (sessionStorage.getItem("LensCraftAuth") === "true") {
        document.getElementById("adminApp").style.display = "block";
        loadData();
      } else {
        // If not logged in, ask for password
        const password = prompt("Authorized Personnel Only.\nEnter Security Key:");
        if (password === "LensCraft@22") {
          sessionStorage.setItem("LensCraftAuth", "true"); // Save login memory
          document.getElementById("adminApp").style.display = "block";
          loadData();
        } else {
          document.body.innerHTML = "<div style='display:flex; height:100vh; align-items:center; justify-content:center;'><h1 style='font-size:3rem; font-weight:200; color:#555;'>Access Denied.</h1></div>";
        }
      }

    }, 500);
  }, 1000); 
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('hidden');
  document.getElementById('mainContent').classList.toggle('expanded');
});

function goHome() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const welcome = document.getElementById('welcomePanel');
  if (welcome) welcome.classList.add('active');
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('mainContent').classList.add('expanded');
}

// 👇 NEW: Direct Full Page Reload without password 👇
async function reloadDatabase() {
  const btn = document.querySelector('.nav a[onclick="reloadDatabase(); return false;"]');
  if (btn) btn.innerHTML = "⏳ Reloading...";
  
  try {
    // Tell backend to re-seed missing data
    await fetch('/api/admin/reload-database', { method: 'POST' });
  } catch (e) {}

  // Instantly execute a hard page reload (will bypass password prompt!)
  window.location.reload();
}

function switchTab(tab) {
  const welcome = document.getElementById('welcomePanel');
  if(welcome) welcome.classList.remove('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  if (event && event.currentTarget && event.currentTarget.classList.contains('nav-btn')) event.currentTarget.classList.add('active');
  document.getElementById(tab + 'Panel').classList.add('active');
  document.getElementById('sidebar').classList.add('hidden');
  document.getElementById('mainContent').classList.add('expanded');
}

function loadData() {
  fetchStaff(); 
  fetchBookings(); 
  fetchQuotes(); 
  fetchPackages();
  fetchGallery(); 
}

function closeModal(modalId) { 
  document.getElementById(modalId).style.display = 'none'; 
  
  if (modalId === 'mediaViewerModal') {
    document.getElementById('mediaViewerContent').innerHTML = '';
  }
}

function filterTable(tableId, query) {
  const filter = query.toLowerCase();
  const rows = document.getElementById(tableId).getElementsByTagName('tr');
  for (let i = 0; i < rows.length; i++) {
    rows[i].style.display = rows[i].textContent.toLowerCase().includes(filter) ? '' : 'none';
  }
}

function toggleFilterPanel(panelId) {
  const panel = document.getElementById(panelId);
  panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
}

function formatToIST(dbTimestamp) {
  if (!dbTimestamp) return "-";
  const safeDateStr = dbTimestamp.replace(' ', 'T') + (dbTimestamp.includes('Z') ? '' : 'Z');
  const dateObj = new Date(safeDateStr);
  return dateObj.toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata', 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', hour12: true 
  });
}

/* ================= STAFF MANAGEMENT ================= */
let staffData = [];
async function fetchStaff() {
  const res = await fetch(`/api/admin/staff`);
  const json = await res.json();
  staffData = json.data || [];
  
  const tbody = document.getElementById('staffTableBody'); tbody.innerHTML = '';
  if (staffData.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color:#555;">No teams registered.</td></tr>'; 
  } else {
    // 👇 Added 'index' here to count rows
    staffData.forEach((s, index) => {
      // 👇 Replaced s.id with (index + 1) for a normal number
      tbody.innerHTML += `<tr><td style="color:#555;">${index + 1}</td><td style="color:#fff; font-weight:500;">${s.group_name}</td><td style="color:#aaa;">${s.email}</td>
        <td><div class="action-icons"><button class="icon-btn" onclick="openStaffModal('${s.id}')">✏️ <span class="btn-text">Edit</span></button><button class="icon-btn delete" onclick="deleteStaff('${s.id}')">🗑️ <span class="btn-text">Delete</span></button></div></td></tr>`;
    });
  }

  const groupSelect = document.getElementById('b_group');
  groupSelect.innerHTML = '<option value="">Unassigned</option>';
  staffData.forEach(s => {
    groupSelect.innerHTML += `<option value="${s.group_name}">${s.group_name}</option>`;
  });
}

function openStaffModal(id = null) {
  document.getElementById('staffModal').style.display = 'flex';
  if(id) {
    const s = staffData.find(x => x.id == id);
    document.getElementById('s_id').value = s.id; document.getElementById('s_groupName').value = s.group_name; document.getElementById('s_email').value = s.email;
  } else { document.getElementById('s_id').value = ""; document.getElementById('s_groupName').value = ""; document.getElementById('s_email').value = ""; }
}
async function saveStaff() {
  const id = document.getElementById('s_id').value;
  await fetch(id ? `/api/admin/staff/${id}` : `/api/admin/staff`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_name: document.getElementById('s_groupName').value, email: document.getElementById('s_email').value }) });
  closeModal('staffModal'); fetchStaff();
}
async function deleteStaff(id) { if(confirm("Delete this team?")) { await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' }); fetchStaff(); } }

/* ================= BOOKINGS MANAGEMENT ================= */
let bookingsData = [];

async function fetchBookings() {
  try {
    const res = await fetch(`/api/admin/bookings`);
    const json = await res.json();
    bookingsData = json.data || [];
    bookingsData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    renderBookingsTable(bookingsData);
  } catch (e) { console.log(e); }
}

function renderBookingsTable(dataToRender) {
  const tbody = document.getElementById('bookingsTableBody');
  tbody.innerHTML = '';
  
  if (dataToRender.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="17" style="text-align:center; padding: 40px; color:#555;">No records match your criteria.</td></tr>'; 
    return; 
  }

  // 👇 Added 'index' here
  dataToRender.forEach((b, index) => {
    let dbStatus = b.payment_status === "" ? "Awaiting Response" : (b.payment_status || 'Pending');
    let payClass = 'status-pending';
    if(dbStatus.toLowerCase() === 'paid') payClass = 'status-paid';
    else if(dbStatus.toLowerCase() === 'awaiting response') payClass = ''; 

    const istDate = formatToIST(b.created_at);
    const amtPaidStr = b.paid_amount && b.paid_amount !== '0' ? `₹${Number(b.paid_amount).toLocaleString('en-IN')}` : '₹0';
    const currentShootStatus = b.shoot_status || 'Pending';
    const shootStatusColor = currentShootStatus === 'Done' ? '#2ecc71' : '#f39c12';

    tbody.innerHTML += `
      <tr>
        <td style="color:#555;">${index + 1}</td><td style="font-family:monospace; color:#ccc;">${b.booking_id}</td>
        <td><b style="color:#fff;">${b.name}</b></td><td>${b.phone}</td><td style="color:#aaa;">${b.email}</td>
        <td>${b.package}</td>
        <td>
          <span style="color:#fff;">Total: ${b.amount}</span><br>
          <span style="color:#2ecc71; font-size: 11px;">Paid: ${amtPaidStr}</span>
        </td>
        <td><span class="status-pill ${payClass}">${dbStatus}</span></td>
        <td>${b.payment_method || '-'}</td><td><b style="color:#fff;">${b.assigned_group || '-'}</b></td>
        <td>${b.from_date ? b.from_date.replace('T', ' ') : '-'}</td><td>${b.to_date ? b.to_date.replace('T', ' ') : '-'}</td>
        <td>${b.pincode || '-'}</td><td>${b.location}</td><td style="color:#666; font-size:12px;">${istDate}</td>
        <td><b style="color:${shootStatusColor};">${currentShootStatus}</b></td>
        <td style="position: sticky; right: 0; background: #111; border-left: 1px solid #222;">
          <div class="action-icons"><button class="icon-btn" onclick="openBookingModal('${b.id}')">✏️ <span class="btn-text">Edit</span></button><button class="icon-btn delete" onclick="deleteBooking('${b.id}')">🗑️ <span class="btn-text">Delete</span></button></div>
        </td>
      </tr>`;
  });
}

function applyBookingFilters() {
  const sortOrder = document.getElementById('f_idSort').value;
  const f_startDate = document.getElementById('f_startDate').value; 
  const f_endDate = document.getElementById('f_endDate').value; 
  const f_month = document.getElementById('f_month').value;
  const f_year = document.getElementById('f_year').value.trim();
  const f_dateSubmitted = document.getElementById('f_dateSubmitted').value;
  const f_payStatus = document.getElementById('f_payStatus').value;

  const filtered = bookingsData.filter(b => {
    let dbStatus = b.payment_status === "" ? "Awaiting Response" : (b.payment_status || 'Pending');
    if (f_payStatus && dbStatus !== f_payStatus) return false;
    if (f_startDate && b.from_date && !b.from_date.startsWith(f_startDate)) return false;
    if (f_endDate && b.to_date && !b.to_date.startsWith(f_endDate)) return false;
    if (f_dateSubmitted && b.created_at && !b.created_at.startsWith(f_dateSubmitted)) return false;
    if ((f_month || f_year) && b.from_date) {
      const dateObj = new Date(b.from_date);
      if (f_month && (dateObj.getMonth() + 1).toString() !== f_month) return false;
      if (f_year && dateObj.getFullYear().toString() !== f_year) return false;
    }
    return true; 
  });

  filtered.sort((a, b) => sortOrder === 'asc' ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at));
  renderBookingsTable(filtered);
}

function clearBookingFilters() {
  document.getElementById('f_idSort').value = 'asc';
  document.getElementById('f_startDate').value = '';
  document.getElementById('f_endDate').value = '';
  document.getElementById('f_month').value = '';
  document.getElementById('f_year').value = '';
  document.getElementById('f_dateSubmitted').value = '';
  document.getElementById('f_payStatus').value = '';
  bookingsData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  renderBookingsTable(bookingsData); 
}

function openBookingModal(id = null) {
  document.getElementById('bookingModal').style.display = 'flex';
  if (id) {
    const b = bookingsData.find(x => x.id == id);
    document.getElementById('b_id').value = b.id; 
    document.getElementById('b_bookingId').value = b.booking_id;
    document.getElementById('b_name').value = b.name; 
    document.getElementById('b_phone').value = b.phone;
    document.getElementById('b_email').value = b.email; 
    // 👇 NEW: Safely set the dropdown value, even if it's an old deleted package 👇
    const packageDropdown = document.getElementById('b_package');
    if (!packageDropdown.querySelector(`option[value="${b.package}"]`)) {
      packageDropdown.innerHTML += `<option value="${b.package}">${b.package}</option>`;
    }
    packageDropdown.value = b.package;
    document.getElementById('b_amount').value = b.amount; 
    document.getElementById('b_paidAmount').value = b.paid_amount || '';
    document.getElementById('b_from').value = b.from_date;
    document.getElementById('b_to').value = b.to_date; 
    document.getElementById('b_pincode').value = b.pincode || '';
    document.getElementById('b_location').value = b.location; 
    document.getElementById('b_group').value = b.assigned_group || ''; 
    document.getElementById('b_payStatus').value = b.payment_status || ''; 
    document.getElementById('b_payMethod').value = b.payment_method || '';
    document.getElementById('b_shootStatus').value = b.shoot_status || 'Pending';
  } else {
    document.getElementById('b_id').value = ""; 
    document.getElementById('b_bookingId').value = "LCS" + Date.now().toString().slice(-8); 
    document.getElementById('b_name').value = ""; 
    document.getElementById('b_phone').value = ""; 
    document.getElementById('b_email').value = "";
    document.getElementById('b_package').value = "Manual Entry"; 
    document.getElementById('b_amount').value = "₹0"; 
    document.getElementById('b_paidAmount').value = "";
    document.getElementById('b_from').value = "";
    document.getElementById('b_to').value = ""; 
    document.getElementById('b_pincode').value = ""; 
    document.getElementById('b_location').value = "";
    document.getElementById('b_group').value = ""; 
    document.getElementById('b_payStatus').value = ""; 
    document.getElementById('b_payMethod').value = "";
    document.getElementById('b_shootStatus').value = 'Pending';
  }
  // Reset schedule preview when opening modal
  document.getElementById('daySchedulePreview').style.display = 'none';
  
  // Listen for date changes
  document.getElementById('b_from').removeEventListener('change', updateDaySchedulePreview);
  document.getElementById('b_from').addEventListener('change', updateDaySchedulePreview);

  // If we are editing an existing booking, show the schedule immediately
  if (id) updateDaySchedulePreview();
}

async function saveBooking() {
  const amountStr = document.getElementById('b_amount').value;
  const paidStr = document.getElementById('b_paidAmount').value || '0';

  const totalNum = parseInt(amountStr.replace(/[^0-9]/g, '')) || 0;
  const paidNum = parseInt(paidStr.replace(/[^0-9]/g, '')) || 0;

  if (paidNum > totalNum) {
    alert(`Validation Error: The Amount Paid (₹${paidNum}) cannot be greater than the Total Package Amount (₹${totalNum}).`);
    return;
  }

  // Variables for Conflict & Time Check
  const fromDateStr = document.getElementById('b_from').value;
  const toDateStr = document.getElementById('b_to').value;
  const assignedGroup = document.getElementById('b_group').value;
  const currentId = document.getElementById('b_id').value;
  const shootStatus = document.getElementById('b_shootStatus').value;

  // 👇 NEW LOGIC: Prevent marking as "Done" before the shoot finishes 👇
  if (shootStatus === 'Done' && toDateStr) {
    const endDate = new Date(toDateStr);
    const now = new Date();
    
    if (now < endDate) {
      alert(`⏱️ TIME ERROR ⏱️\n\nYou cannot mark this shoot as "Done" because the event has not finished yet!\n\nScheduled Conclusion: ${toDateStr.replace('T', ' ')}`);
      return; // STOPS THE SAVE IMMEDIATELY
    }
  }

  // 👇 BULLETPROOF FRONTEND CONFLICT CHECK 👇
  if (assignedGroup && assignedGroup !== "") {
    const conflict = bookingsData.find(b => {
      if (currentId && b.id == currentId) return false; 
      if (b.assigned_group !== assignedGroup) return false; 
      if (!b.from_date || !b.to_date) return false;
      return (b.from_date < toDateStr && b.to_date > fromDateStr);
    });

    if (conflict) {
      const conflictMsg = `Team ${assignedGroup} is already booked for another event between:\n\n${conflict.from_date.replace('T', ' ')}  and  ${conflict.to_date.replace('T', ' ')}.\n\nPlease select a different team or change the time.`;
      
      const customModal = document.getElementById('customAlertModal');
      const customText = document.getElementById('customAlertText');
      
      if (customModal && customText) {
        customText.innerText = conflictMsg;
        customModal.style.display = 'flex';
      } else {
        alert(`⚠️ SCHEDULING CONFLICT ⚠️\n\n` + conflictMsg);
      }
      return; // STOPS THE SAVE
    }
  }


  const payload = {
    bookingId: document.getElementById('b_bookingId').value, 
    name: document.getElementById('b_name').value, 
    phone: document.getElementById('b_phone').value,
    email: document.getElementById('b_email').value, 
    package: document.getElementById('b_package').value, 
    amount: amountStr,
    paid_amount: paidStr, 
    from_date: fromDateStr, 
    to_date: toDateStr, 
    pincode: document.getElementById('b_pincode').value,
    location: document.getElementById('b_location').value, 
    assigned_group: assignedGroup, 
    payment_status: document.getElementById('b_payStatus').value,
    payment_method: document.getElementById('b_payMethod').value,
    shoot_status: shootStatus
  };
  
  await fetch(currentId ? `/api/admin/bookings/${currentId}` : `/api/admin/bookings`, { 
    method: currentId ? 'PUT' : 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify(payload) 
  });
  
  closeModal('bookingModal'); 
  fetchBookings(); 
}

async function deleteBooking(id) { if(confirm("Delete this booking?")) { await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' }); fetchBookings(); } }

/* ================= QUOTES ================= */
let quotesData = [];
async function fetchQuotes() {
  try {
    const res = await fetch(`/api/admin/quotes`);
    const json = await res.json();
    quotesData = json.data || [];
    quotesData.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); 
    const tbody = document.getElementById('quotesTableBody');
    tbody.innerHTML = '';
    if(quotesData.length === 0) { tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 40px; color:#555;">No inquiries found.</td></tr>'; return; }

    // 👇 Added 'index' here
    quotesData.forEach((q, index) => {
      tbody.innerHTML += `
        <tr>
          <td style="color:#555;">${index + 1}</td><td><b style="color:#fff;">${q.name}</b></td><td>${q.phone}</td><td style="color:#aaa;">${q.email}</td>
          <td>${q.shoot_type}</td><td>${q.event_dates}</td><td>${q.location}</td><td>${q.budget || '-'}</td><td>${q.services || '-'}</td>
          <td>${q.vision_link ? `<a href="${q.vision_link}" target="_blank" style="color:#ccc; text-decoration:underline;">View Link</a>` : '-'}</td><td>${q.notes ? q.notes.substring(0, 30) + '...' : '-'}</td>
          <td style="color:#666; font-size:12px;">${formatToIST(q.created_at)}</td>
          <td style="position: sticky; right: 0; background: #111; border-left: 1px solid #222;">
            <div class="action-icons"><button class="icon-btn" onclick="openQuoteModal('${q.id}')">✏️ <span class="btn-text">Edit</span></button><button class="icon-btn delete" onclick="deleteQuote('${q.id}')">🗑️ <span class="btn-text">Delete</span></button></div>
          </td>
        </tr>`;
    });
  } catch (e) {}
}

function openQuoteModal(id) {
  document.getElementById('quoteModal').style.display = 'flex';
  const q = quotesData.find(x => x.id == id);
  document.getElementById('q_id').value = q.id; document.getElementById('q_name').value = q.name; document.getElementById('q_phone').value = q.phone;
  document.getElementById('q_email').value = q.email; document.getElementById('q_type').value = q.shoot_type; document.getElementById('q_dates').value = q.event_dates;
  document.getElementById('q_location').value = q.location; document.getElementById('q_budget').value = q.budget; document.getElementById('q_services').value = q.services;
  document.getElementById('q_vision').value = q.vision_link; document.getElementById('q_notes').value = q.notes;
}
async function saveQuote() {
  const payload = {
    name: document.getElementById('q_name').value, phone: document.getElementById('q_phone').value, email: document.getElementById('q_email').value,
    shoot_type: document.getElementById('q_type').value, event_dates: document.getElementById('q_dates').value, location: document.getElementById('q_location').value,
    budget: document.getElementById('q_budget').value, services: document.getElementById('q_services').value, vision_link: document.getElementById('q_vision').value, notes: document.getElementById('q_notes').value
  };
  await fetch(`/api/admin/quotes/${document.getElementById('q_id').value}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  closeModal('quoteModal'); fetchQuotes(); 
}
async function deleteQuote(id) { if(confirm("Delete this quote?")) { await fetch(`/api/admin/quotes/${id}`, { method: 'DELETE' }); fetchQuotes(); } }

/* ================= PACKAGES MANAGEMENT & GALLERY DROPDOWNS ================= */
let packagesData = [];

async function fetchPackages() {
  try {
    const res = await fetch(`/api/packages`);
    const json = await res.json();
    packagesData = json.data || [];
    packagesData.sort((a, b) => a.price - b.price);
    renderPackagesTable(packagesData);
    updateCategoryDropdowns(packagesData); 
    
    // 👇 NEW: Populate the booking modal dropdown 👇
    const bPackage = document.getElementById('b_package');
    if (bPackage) {
      bPackage.innerHTML = '<option value="Manual Entry">Manual Entry</option>';
      packagesData.forEach(p => {
        bPackage.innerHTML += `<option value="${p.title}" data-price="${p.price}">${p.title} (₹${p.price.toLocaleString('en-IN')})</option>`;
      });
    }
    // 👆 END NEW 👆

  } catch (error) { console.error(error); }
}

function updateCategoryDropdowns(data) {
  const uniqueCategories = [...new Set(data.map(p => p.category.toLowerCase()))];
  
  const filterPkg = document.getElementById('filterPackageCategory');
  const modalPkg = document.getElementById('p_category');
  const galleryCat = document.getElementById('g_category');

  if(filterPkg) filterPkg.innerHTML = '<option value="all">Sort: All Categories</option>';
  if(modalPkg) modalPkg.innerHTML = '';
  if(galleryCat) galleryCat.innerHTML = '';

  uniqueCategories.forEach(cat => {
    const titleCaseCat = cat.charAt(0).toUpperCase() + cat.slice(1);
    if(filterPkg) filterPkg.innerHTML += `<option value="${cat}">${titleCaseCat}</option>`;
    if(modalPkg) modalPkg.innerHTML += `<option value="${cat}">${titleCaseCat}</option>`;
    if(galleryCat) galleryCat.innerHTML += `<option value="${cat}">${titleCaseCat}</option>`;
  });
}

function renderPackagesTable(dataToRender) {
  const tbody = document.getElementById('packagesTableBody');
  tbody.innerHTML = '';
  
  if (dataToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color:#555;">No packages match your sort criteria.</td></tr>'; 
    return;
  }

  // 👇 Added 'index' here
  dataToRender.forEach((p, index) => {
    const featList = p.features.replace(/\n/g, '<br>• ');
    const premLabel = p.is_premium ? '<b style="color:#ffffff;">YES (Premium)</b>' : '<span style="color:#555;">No</span>';
    
    tbody.innerHTML += `
      <tr>
        <td style="color:#555;">${index + 1}</td>
        <td style="text-transform:uppercase; color:#888;">${p.category}</td>
        <td><b style="color:#fff;">${p.title}</b></td>
        <td><span style="color:#fff; font-size:15px;">₹${p.price.toLocaleString('en-IN')}</span></td>
        <td>${premLabel}</td>
        <td style="color:#ccc; font-size:12px; line-height:1.5;">• ${featList}</td>
        <td style="position: sticky; right: 0; background: #111; border-left: 1px solid #222;">
          <div class="action-icons">
            <button class="icon-btn" onclick="openPackageModal('${p.id}')">✏️ <span class="btn-text">Edit</span></button>
            <button class="icon-btn delete" onclick="deletePackage('${p.id}')">🗑️ <span class="btn-text">Delete</span></button>
          </div>
        </td>
      </tr>
    `;
  });
}

function applyPackageFilter() {
  const category = document.getElementById('filterPackageCategory').value;
  if (category === 'all') {
    renderPackagesTable(packagesData);
  } else {
    const filtered = packagesData.filter(p => p.category.toLowerCase() === category);
    renderPackagesTable(filtered);
  }
}

function openPackageModal(id = null) {
  document.getElementById('packageModal').style.display = 'flex';
  if (id) {
    document.getElementById('packageModalTitle').innerText = "Edit Package";
    const p = packagesData.find(x => x.id == id);
    document.getElementById('p_id').value = p.id; document.getElementById('p_category').value = p.category;
    document.getElementById('p_title').value = p.title; document.getElementById('p_price').value = p.price;
    document.getElementById('p_features').value = p.features; document.getElementById('p_premium').value = p.is_premium;
  } else {
    document.getElementById('packageModalTitle').innerText = "Create Package";
    document.getElementById('p_id').value = ""; document.getElementById('p_title').value = ""; document.getElementById('p_price').value = "";
    document.getElementById('p_features').value = ""; document.getElementById('p_premium').value = "0";
  }
}

async function savePackage() {
  const payload = {
    category: document.getElementById('p_category').value, title: document.getElementById('p_title').value,
    price: document.getElementById('p_price').value, features: document.getElementById('p_features').value,
    is_premium: document.getElementById('p_premium').value
  };
  const id = document.getElementById('p_id').value;
  await fetch(id ? `/api/admin/packages/${id}` : `/api/admin/packages`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  closeModal('packageModal'); fetchPackages();
}

async function deletePackage(id) { if(confirm("Delete this package?")) { await fetch(`/api/admin/packages/${id}`, { method: 'DELETE' }); fetchPackages(); } }

/* ================= GALLERY MANAGEMENT ================= */
async function fetchGallery() {
  try {
    const res = await fetch(`/api/gallery`);
    const json = await res.json();
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    if (json.data && json.data.length > 0) {
      json.data.forEach(item => {
        let mediaHtml = '';
        const mediaUrl = item.url;
        
        if (item.type === 'video') {
          mediaHtml = `<video src="${mediaUrl}" muted loop autoplay playsinline></video>`;
        } else {
          mediaHtml = `<img src="${mediaUrl}" alt="${item.category}">`;
        }

        grid.innerHTML += `
          <div class="gallery-item" onclick="viewMedia('${mediaUrl}', '${item.type}')">
            ${mediaHtml}
            <span class="badge">${item.category}</span>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteGalleryMedia('${item.id}')">✖</button>
          </div>
        `;
      });
    } else {
      grid.innerHTML = '<p style="color:#555; padding: 20px;">No media uploaded yet.</p>';
    }
  } catch (e) {
    console.log(e);
  }
}

async function uploadGalleryMedia() {
  const fileInput = document.getElementById('g_file');
  const category = document.getElementById('g_category').value;
  const type = document.getElementById('g_type').value;

  if (fileInput.files.length === 0) {
    alert("Please select a file to upload.");
    return;
  }

  const formData = new FormData();
  formData.append('media', fileInput.files[0]);
  formData.append('category', category);
  formData.append('type', type);

  try {
    const res = await fetch(`/api/admin/gallery`, {
      method: 'POST',
      body: formData 
    });
    
    const json = await res.json();
    if (json.status === 'success') {
      fileInput.value = ''; 
      fetchGallery(); 
    } else {
      alert("Error uploading file.");
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteGalleryMedia(id) {
  if (confirm("Are you sure you want to permanently delete this media file?")) {
    try {
      await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
      fetchGallery(); 
    } catch (e) {
      console.log(e);
    }
  }
}

function viewMedia(url, type) {
  const modal = document.getElementById('mediaViewerModal');
  const content = document.getElementById('mediaViewerContent');
  
  if (type === 'video') {
    content.innerHTML = `<video src="${url}" controls preload="none"></video>`;
  } else {
    content.innerHTML = `<img src="${url}">`;
  }
  
  modal.style.display = 'flex';
}

// 👇 NEW: Function to show busy slots for the selected day 👇
function updateDaySchedulePreview() {
  const fromInput = document.getElementById('b_from').value;
  const previewBox = document.getElementById('daySchedulePreview');
  const listContainer = document.getElementById('scheduleList');

  if (!fromInput) {
    previewBox.style.display = 'none';
    return;
  }

  // Extract just the YYYY-MM-DD part
  const selectedDate = fromInput.split('T')[0];
  
  // Filter all bookings that happen on this day
  const dailyBookings = bookingsData.filter(b => b.from_date && b.from_date.startsWith(selectedDate));

  if (dailyBookings.length > 0) {
    previewBox.style.display = 'block';
    listContainer.innerHTML = dailyBookings.map(b => {
      const startTime = b.from_date.split('T')[1];
      const endTime = b.to_date.split('T')[1];
      return `<div style="border-bottom: 1px solid #1a1a1a; padding: 5px 0;">
                <b style="color: #fff;">${startTime} - ${endTime}</b>: 
                <span style="color: #888;">${b.assigned_group || 'Unassigned'}</span> 
                (${b.name})
              </div>`;
    }).join('');
  } else {
    previewBox.style.display = 'block';
    listContainer.innerHTML = `<div style="color: #2ecc71; font-weight: 500;">✓ All slots available. No bookings yet.</div>`;
  }
}


/* ================= AUTOMATION: PINCODE & PACKAGE AUTO-FILL ================= */

// 1. Auto-fill Total Amount when a package is selected
document.getElementById('b_package').addEventListener('change', function(e) {
  const selectedOption = e.target.options[e.target.selectedIndex];
  const price = selectedOption.getAttribute('data-price');
  const amountInput = document.getElementById('b_amount');
  
  if (price) {
    amountInput.value = `₹${Number(price).toLocaleString('en-IN')}`;
  } else if (e.target.value === "Manual Entry") {
    amountInput.value = "₹0"; // Reset for manual
  }
});

// 2. Auto-fetch Location Dropdown List from Pincode
document.getElementById('b_pincode').addEventListener('input', async function(e) {
  const pin = e.target.value.trim();
  const statusEl = document.getElementById('pinStatus');
  const locInput = document.getElementById('b_location');
  const dataList = document.getElementById('locationOptions');
  
  if (pin.length === 6) {
    statusEl.innerText = "⏳ Checking...";
    statusEl.style.color = "#ffb703";
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      
      if (data[0].Status === 'Success') {
        const postOffices = data[0].PostOffice;
        
        // 1. Clear any old options from the dropdown
        dataList.innerHTML = '';
        
        // 2. Loop through every village/area in that pincode and add it to the dropdown list
        postOffices.forEach(po => {
          const fullAddress = `${po.Name}, ${po.District}, ${po.State}`;
          dataList.innerHTML += `<option value="${fullAddress}">`;
        });

        // 3. Clear the venue box and focus on it so the user sees the dropdown instantly
        locInput.value = "";
        locInput.focus();
        
        statusEl.innerText = `✅ Found ${postOffices.length} areas`;
        statusEl.style.color = "#2ecc71";
      } else {
        statusEl.innerText = "❌ Invalid Pincode";
        statusEl.style.color = "#ff4a4a";
        dataList.innerHTML = ''; // Clear list if invalid
      }
    } catch(err) {
      statusEl.innerText = "❌ Network Error";
      statusEl.style.color = "#ff4a4a";
    }
  } else {
    // Clear status and dropdown if they delete the pincode
    statusEl.innerText = ""; 
    if (dataList) dataList.innerHTML = ''; 
  }
});