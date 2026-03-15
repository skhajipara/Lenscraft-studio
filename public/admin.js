/* =========================================================
   LENSCRAFT PRO ADMIN DASHBOARD SCRIPT (B&W THEME)
========================================================= */

const API_BASE = window.location.origin.includes("localhost") ? window.location.origin : "http://localhost:3000";

window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('preloader').classList.add('preloader-hidden');
    setTimeout(() => {
      const password = prompt("Authorized Personnel Only.\nEnter Security Key:");
      if (password === "LensCraft@22") {
        document.getElementById("adminApp").style.display = "block";
        loadData();
      } else {
        document.body.innerHTML = "<div style='display:flex; height:100vh; align-items:center; justify-content:center;'><h1 style='font-size:3rem; font-weight:200; color:#555;'>Access Denied.</h1></div>";
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
  
  // Clean up media viewer if closed
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
  const res = await fetch(`${API_BASE}/api/admin/staff`);
  const json = await res.json();
  staffData = json.data || [];
  
  const tbody = document.getElementById('staffTableBody'); tbody.innerHTML = '';
  if (staffData.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 40px; color:#555;">No teams registered.</td></tr>'; 
  } else {
    staffData.forEach(s => {
      tbody.innerHTML += `<tr><td style="color:#555;">${s.id}</td><td style="color:#fff; font-weight:500;">${s.group_name}</td><td style="color:#aaa;">${s.email}</td>
        <td><div class="action-icons"><button class="icon-btn" onclick="openStaffModal(${s.id})">✏️ <span class="btn-text">Edit</span></button><button class="icon-btn delete" onclick="deleteStaff(${s.id})">🗑️ <span class="btn-text">Delete</span></button></div></td></tr>`;
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
    const s = staffData.find(x => x.id === id);
    document.getElementById('s_id').value = s.id; document.getElementById('s_groupName').value = s.group_name; document.getElementById('s_email').value = s.email;
  } else { document.getElementById('s_id').value = ""; document.getElementById('s_groupName').value = ""; document.getElementById('s_email').value = ""; }
}
async function saveStaff() {
  const id = document.getElementById('s_id').value;
  await fetch(id ? `${API_BASE}/api/admin/staff/${id}` : `${API_BASE}/api/admin/staff`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_name: document.getElementById('s_groupName').value, email: document.getElementById('s_email').value }) });
  closeModal('staffModal'); fetchStaff();
}
async function deleteStaff(id) { if(confirm("Delete this team?")) { await fetch(`${API_BASE}/api/admin/staff/${id}`, { method: 'DELETE' }); fetchStaff(); } }

/* ================= BOOKINGS MANAGEMENT & FILTERS ================= */
let bookingsData = [];

async function fetchBookings() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/bookings`);
    const json = await res.json();
    bookingsData = json.data || [];
    bookingsData.sort((a, b) => a.id - b.id);
    renderBookingsTable(bookingsData);
  } catch (e) { console.log(e); }
}

function renderBookingsTable(dataToRender) {
  const tbody = document.getElementById('bookingsTableBody');
  tbody.innerHTML = '';
  
  if (dataToRender.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="16" style="text-align:center; padding: 40px; color:#555;">No records match your criteria.</td></tr>'; 
    return; 
  }

  dataToRender.forEach(b => {
    let dbStatus = b.payment_status === "" ? "Awaiting Response" : (b.payment_status || 'Pending');
    let payClass = 'status-pending';
    if(dbStatus.toLowerCase() === 'paid') payClass = 'status-paid';
    else if(dbStatus.toLowerCase() === 'awaiting response') payClass = ''; 

    const istDate = formatToIST(b.created_at);
    const amtPaidStr = b.paid_amount && b.paid_amount !== '0' ? `₹${Number(b.paid_amount).toLocaleString('en-IN')}` : '₹0';

    tbody.innerHTML += `
      <tr>
        <td style="color:#555;">${b.id}</td><td style="font-family:monospace; color:#ccc;">${b.booking_id}</td>
        <td><b style="color:#fff;">${b.name}</b></td><td>${b.phone}</td><td style="color:#aaa;">${b.email}</td>
        <td>${b.package}</td>
        <td>
          <span style="color:#fff;">Total: ${b.amount}</span><br>
          <span style="color:#2ecc71; font-size: 11px;">Paid: ${amtPaidStr}</span>
        </td>
        <td><span class="status-pill ${payClass}">${dbStatus}</span></td>
        <td>${b.payment_method || '-'}</td><td><b style="color:#fff;">${b.assigned_group || '-'}</b></td>
        <td>${b.from_date.replace('T', ' ')}</td><td>${b.to_date.replace('T', ' ')}</td>
        <td>${b.pincode || '-'}</td><td>${b.location}</td><td style="color:#666; font-size:12px;">${istDate}</td>
        <td style="position: sticky; right: 0; background: #111; border-left: 1px solid #222;">
          <div class="action-icons"><button class="icon-btn" onclick="openBookingModal(${b.id})">✏️ <span class="btn-text">Edit</span></button><button class="icon-btn delete" onclick="deleteBooking(${b.id})">🗑️ <span class="btn-text">Delete</span></button></div>
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

  filtered.sort((a, b) => sortOrder === 'asc' ? a.id - b.id : b.id - a.id);
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
  bookingsData.sort((a, b) => a.id - b.id);
  renderBookingsTable(bookingsData); 
}

function openBookingModal(id = null) {
  document.getElementById('bookingModal').style.display = 'flex';
  if (id) {
    const b = bookingsData.find(x => x.id === id);
    document.getElementById('b_id').value = b.id; 
    document.getElementById('b_bookingId').value = b.booking_id;
    document.getElementById('b_name').value = b.name; 
    document.getElementById('b_phone').value = b.phone;
    document.getElementById('b_email').value = b.email; 
    document.getElementById('b_package').value = b.package;
    document.getElementById('b_amount').value = b.amount; 
    document.getElementById('b_paidAmount').value = b.paid_amount || '';
    document.getElementById('b_from').value = b.from_date;
    document.getElementById('b_to').value = b.to_date; 
    document.getElementById('b_pincode').value = b.pincode || '';
    document.getElementById('b_location').value = b.location; 
    document.getElementById('b_group').value = b.assigned_group || ''; 
    document.getElementById('b_payStatus').value = b.payment_status || ''; 
    document.getElementById('b_payMethod').value = b.payment_method || '';
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
  }
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

  const payload = {
    bookingId: document.getElementById('b_bookingId').value, 
    name: document.getElementById('b_name').value, 
    phone: document.getElementById('b_phone').value,
    email: document.getElementById('b_email').value, 
    package: document.getElementById('b_package').value, 
    amount: amountStr,
    paid_amount: paidStr, 
    from_date: document.getElementById('b_from').value, 
    to_date: document.getElementById('b_to').value, 
    pincode: document.getElementById('b_pincode').value,
    location: document.getElementById('b_location').value, 
    assigned_group: document.getElementById('b_group').value, 
    payment_status: document.getElementById('b_payStatus').value,
    payment_method: document.getElementById('b_payMethod').value
  };
  const id = document.getElementById('b_id').value;
  await fetch(id ? `${API_BASE}/api/admin/bookings/${id}` : `${API_BASE}/api/admin/bookings`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  closeModal('bookingModal'); fetchBookings(); 
}

async function deleteBooking(id) { if(confirm("Delete this booking?")) { await fetch(`${API_BASE}/api/admin/bookings/${id}`, { method: 'DELETE' }); fetchBookings(); } }

/* ================= QUOTES ================= */
let quotesData = [];
async function fetchQuotes() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/quotes`);
    const json = await res.json();
    quotesData = json.data || [];
    quotesData.sort((a, b) => a.id - b.id); 
    const tbody = document.getElementById('quotesTableBody');
    tbody.innerHTML = '';
    if(quotesData.length === 0) { tbody.innerHTML = '<tr><td colspan="13" style="text-align:center; padding: 40px; color:#555;">No inquiries found.</td></tr>'; return; }

    quotesData.forEach(q => {
      tbody.innerHTML += `
        <tr>
          <td style="color:#555;">Q-${q.id}</td><td><b style="color:#fff;">${q.name}</b></td><td>${q.phone}</td><td style="color:#aaa;">${q.email}</td>
          <td>${q.shoot_type}</td><td>${q.event_dates}</td><td>${q.location}</td><td>${q.budget || '-'}</td><td>${q.services || '-'}</td>
          <td>${q.vision_link ? `<a href="${q.vision_link}" target="_blank" style="color:#ccc; text-decoration:underline;">View Link</a>` : '-'}</td><td>${q.notes ? q.notes.substring(0, 30) + '...' : '-'}</td>
          <td style="color:#666; font-size:12px;">${formatToIST(q.created_at)}</td>
          <td style="position: sticky; right: 0; background: #111; border-left: 1px solid #222;">
            <div class="action-icons"><button class="icon-btn" onclick="openQuoteModal(${q.id})">✏️ <span class="btn-text">Edit</span></button><button class="icon-btn delete" onclick="deleteQuote(${q.id})">🗑️ <span class="btn-text">Delete</span></button></div>
          </td>
        </tr>`;
    });
  } catch (e) {}
}

function openQuoteModal(id) {
  document.getElementById('quoteModal').style.display = 'flex';
  const q = quotesData.find(x => x.id === id);
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
  await fetch(`${API_BASE}/api/admin/quotes/${document.getElementById('q_id').value}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  closeModal('quoteModal'); fetchQuotes(); 
}
async function deleteQuote(id) { if(confirm("Delete this quote?")) { await fetch(`${API_BASE}/api/admin/quotes/${id}`, { method: 'DELETE' }); fetchQuotes(); } }

/* ================= PACKAGES MANAGEMENT & GALLERY DROPDOWNS ================= */
let packagesData = [];

async function fetchPackages() {
  try {
    const res = await fetch(`${API_BASE}/api/packages`);
    const json = await res.json();
    packagesData = json.data || [];
    packagesData.sort((a, b) => a.id - b.id);
    renderPackagesTable(packagesData);
    
    // 👇 NEW: Update Gallery Category Dropdown with Real Data from Packages
    updateCategoryDropdowns(packagesData); 
  } catch (error) { console.error(error); }
}

function updateCategoryDropdowns(data) {
  // Extract unique categories from packages
  const uniqueCategories = [...new Set(data.map(p => p.category.toLowerCase()))];
  
  const filterPkg = document.getElementById('filterPackageCategory');
  const modalPkg = document.getElementById('p_category');
  const galleryCat = document.getElementById('g_category');

  if(filterPkg) filterPkg.innerHTML = '<option value="all">Sort: All Categories</option>';
  if(modalPkg) modalPkg.innerHTML = '';
  if(galleryCat) galleryCat.innerHTML = ''; // Clear gallery dropdown

  uniqueCategories.forEach(cat => {
    const titleCaseCat = cat.charAt(0).toUpperCase() + cat.slice(1);
    if(filterPkg) filterPkg.innerHTML += `<option value="${cat}">${titleCaseCat}</option>`;
    if(modalPkg) modalPkg.innerHTML += `<option value="${cat}">${titleCaseCat}</option>`;
    
    // 👇 Inject into Gallery Dropdown
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

  dataToRender.forEach(p => {
    const featList = p.features.replace(/\n/g, '<br>• ');
    const premLabel = p.is_premium ? '<b style="color:#ffffff;">YES (Premium)</b>' : '<span style="color:#555;">No</span>';
    
    tbody.innerHTML += `
      <tr>
        <td style="color:#555;">${p.id}</td>
        <td style="text-transform:uppercase; color:#888;">${p.category}</td>
        <td><b style="color:#fff;">${p.title}</b></td>
        <td><span style="color:#fff; font-size:15px;">₹${p.price.toLocaleString('en-IN')}</span></td>
        <td>${premLabel}</td>
        <td style="color:#ccc; font-size:12px; line-height:1.5;">• ${featList}</td>
        <td style="position: sticky; right: 0; background: #111; border-left: 1px solid #222;">
          <div class="action-icons">
            <button class="icon-btn" onclick="openPackageModal(${p.id})">✏️ <span class="btn-text">Edit</span></button>
            <button class="icon-btn delete" onclick="deletePackage(${p.id})">🗑️ <span class="btn-text">Delete</span></button>
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
    const p = packagesData.find(x => x.id === id);
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
  await fetch(id ? `${API_BASE}/api/admin/packages/${id}` : `${API_BASE}/api/admin/packages`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  closeModal('packageModal'); fetchPackages();
}

async function deletePackage(id) { if(confirm("Delete this package?")) { await fetch(`${API_BASE}/api/admin/packages/${id}`, { method: 'DELETE' }); fetchPackages(); } }

/* ================= GALLERY MANAGEMENT ================= */
async function fetchGallery() {
  try {
    const res = await fetch(`${API_BASE}/api/gallery`);
    const json = await res.json();
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    if (json.data && json.data.length > 0) {
      json.data.forEach(item => {
        let mediaHtml = '';
        if (item.type === 'video') {
          // Changed to loop muted autoplay so it functions as an animated thumbnail
          mediaHtml = `<video src="${item.url}" muted loop autoplay playsinline></video>`;
        } else {
          mediaHtml = `<img src="${item.url}" alt="${item.category}">`;
        }

        // 👇 Added onclick to view media full size
        grid.innerHTML += `
          <div class="gallery-item" onclick="viewMedia('${item.url}', '${item.type}')">
            ${mediaHtml}
            <span class="badge">${item.category}</span>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteGalleryMedia(${item.id})">✖</button>
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
    const res = await fetch(`${API_BASE}/api/admin/gallery`, {
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
      await fetch(`${API_BASE}/api/admin/gallery/${id}`, { method: 'DELETE' });
      fetchGallery(); 
    } catch (e) {
      console.log(e);
    }
  }
}

// 👇 NEW: View Media in Fullscreen Modal
function viewMedia(url, type) {
  const modal = document.getElementById('mediaViewerModal');
  const content = document.getElementById('mediaViewerContent');
  
  if (type === 'video') {
    // Standard video tag. 
    // controls = shows the play button.
    // preload="none" = saves maximum memory, won't load until clicked.
    content.innerHTML = `<video src="${url}" controls preload="none"></video>`;
  } else {
    content.innerHTML = `<img src="${url}">`;
  }
  
  modal.style.display = 'flex';
}

