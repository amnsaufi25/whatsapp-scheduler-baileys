// DOM Elements
const jobsBody = document.getElementById('jobsBody');
const emptyState = document.getElementById('emptyState');
const tableContainer = document.querySelector('.table-container');
const statusEl = document.getElementById('status');
const addBtn = document.getElementById('addBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const jobForm = document.getElementById('jobForm');
const jobIdInput = document.getElementById('jobId');
const phoneInput = document.getElementById('phone');
const messageInput = document.getElementById('message');
const sendAtInput = document.getElementById('sendAt');
const deleteOverlay = document.getElementById('deleteOverlay');
const deleteClose = document.getElementById('deleteClose');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
const qrOverlay = document.getElementById('qrOverlay');
const qrClose = document.getElementById('qrClose');
const qrCanvas = document.getElementById('qrCanvas');
const qrLoading = document.getElementById('qrLoading');
const qrRefreshBtn = document.getElementById('qrRefreshBtn');

let deleteJobId = null;
let currentQrCode = null;

// Fetch jobs from API
async function fetchJobs() {
  try {
    const res = await fetch('/api/jobs');
    const jobs = await res.json();
    renderJobs(jobs);
  } catch (err) {
    console.error('Failed to fetch jobs:', err);
    jobsBody.innerHTML = '<tr><td colspan="5" class="loading">Failed to load jobs</td></tr>';
  }
}

// Render jobs in table
function renderJobs(jobs) {
  if (jobs.length === 0) {
    tableContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  tableContainer.style.display = 'block';
  emptyState.style.display = 'none';

  jobsBody.innerHTML = jobs.map(job => {
    const sendDate = new Date(job.sendAt);
    const formattedDate = sendDate.toLocaleString('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kuala_Lumpur'
    });

    return `
      <tr data-id="${job.id}">
        <td class="phone">${job.phone}</td>
        <td class="message" title="${escapeHtml(job.message)}">${escapeHtml(job.message)}</td>
        <td class="datetime">${formattedDate}</td>
        <td>
          <span class="badge ${job.sent ? 'badge-sent' : 'badge-pending'}">
            ${job.sent ? 'Sent' : 'Pending'}
          </span>
        </td>
        <td>
          <div class="actions-cell">
            <button class="btn btn-icon edit-btn" title="Edit" data-id="${job.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn-icon delete-btn" title="Delete" data-id="${job.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event listeners
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editJob(parseInt(btn.dataset.id)));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => showDeleteConfirm(parseInt(btn.dataset.id)));
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Fetch connection status
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const status = await res.json();
    console.log('Status received:', status.state, 'QR exists:', !!status.qrCode);
    updateStatus(status);
  } catch (err) {
    console.error('Failed to fetch status:', err);
    updateStatus({ state: 'error' });
  }
}

// Update status display
function updateStatus(status) {
  statusEl.className = 'status';
  const textEl = statusEl.querySelector('.status-text');

  switch (status.state) {
    case 'open':
      statusEl.classList.add('connected');
      textEl.textContent = 'Connected';
      currentQrCode = null;
      closeQrModal();
      break;
    case 'qr':
      statusEl.classList.add('qr');
      textEl.textContent = 'Scan QR Code';
      if (status.qrCode) {
        // Always update and render QR code when available
        if (status.qrCode !== currentQrCode) {
          currentQrCode = status.qrCode;
          renderQrCode(status.qrCode);
        }
        // Auto-open QR modal if not already open
        if (!qrOverlay.classList.contains('active')) {
          openQrModal();
        }
      }
      break;
    case 'connecting':
      textEl.textContent = 'Connecting...';
      break;
    case 'close':
    case 'logged_out':
      statusEl.classList.add('disconnected');
      textEl.textContent = 'Disconnected';
      currentQrCode = null;
      break;
    default:
      statusEl.classList.add('disconnected');
      textEl.textContent = 'Unknown';
  }
}

// Render QR code to canvas
async function renderQrCode(qrData) {
  console.log('Rendering QR code, data length:', qrData ? qrData.length : 0);
  console.log('QR data preview:', qrData ? qrData.substring(0, 50) + '...' : 'null');
  
  if (!qrData) {
    qrLoading.textContent = 'No QR data available';
    qrLoading.classList.remove('hidden');
    return;
  }
  
  try {
    qrLoading.classList.remove('hidden');
    qrLoading.textContent = 'Loading QR...';
    
    await QRCode.toCanvas(qrCanvas, qrData, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });
    
    qrLoading.classList.add('hidden');
    console.log('QR code rendered successfully');
  } catch (error) {
    console.error('Failed to render QR code:', error);
    console.error('QR data that failed:', qrData);
    qrLoading.textContent = 'Failed to load QR - check console';
    qrLoading.classList.remove('hidden');
  }
}

// Open QR modal
function openQrModal() {
  qrOverlay.classList.add('active');
}

// Close QR modal
function closeQrModal() {
  qrOverlay.classList.remove('active');
}

// Open modal for new job
function openAddModal() {
  modalTitle.textContent = 'Schedule Message';
  jobIdInput.value = '';
  jobForm.reset();
  
  // Set default datetime to now + 5 minutes
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  sendAtInput.value = toLocalDatetimeString(now);
  
  modalOverlay.classList.add('active');
  phoneInput.focus();
}

// Open modal for editing
async function editJob(id) {
  try {
    const res = await fetch('/api/jobs');
    const jobs = await res.json();
    const job = jobs.find(j => j.id === id);

    if (!job) return;

    modalTitle.textContent = 'Edit Message';
    jobIdInput.value = job.id;
    phoneInput.value = job.phone;
    messageInput.value = job.message;
    sendAtInput.value = toLocalDatetimeString(new Date(job.sendAt));

    modalOverlay.classList.add('active');
    phoneInput.focus();
  } catch (err) {
    console.error('Failed to load job for editing:', err);
  }
}

// Convert date to local datetime-local input format
function toLocalDatetimeString(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

// Close modal
function closeModal() {
  modalOverlay.classList.remove('active');
}

// Handle form submit
async function handleSubmit(e) {
  e.preventDefault();

  const id = jobIdInput.value;
  const data = {
    phone: phoneInput.value.replace(/\D/g, ''), // Remove non-digits
    message: messageInput.value,
    sendAt: new Date(sendAtInput.value).toISOString()
  };

  try {
    const url = id ? `/api/jobs/${id}` : '/api/jobs';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    closeModal();
    fetchJobs();
  } catch (err) {
    console.error('Failed to save job:', err);
    alert('Failed to save: ' + err.message);
  }
}

// Show delete confirmation
function showDeleteConfirm(id) {
  deleteJobId = id;
  deleteOverlay.classList.add('active');
}

// Close delete confirmation
function closeDeleteConfirm() {
  deleteOverlay.classList.remove('active');
  deleteJobId = null;
}

// Handle delete
async function handleDelete() {
  if (!deleteJobId) return;

  try {
    const res = await fetch(`/api/jobs/${deleteJobId}`, { method: 'DELETE' });

    if (!res.ok) {
      throw new Error('Failed to delete');
    }

    closeDeleteConfirm();
    fetchJobs();
  } catch (err) {
    console.error('Failed to delete job:', err);
    alert('Failed to delete job');
  }
}

// Event listeners
addBtn.addEventListener('click', openAddModal);
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
jobForm.addEventListener('submit', handleSubmit);
deleteClose.addEventListener('click', closeDeleteConfirm);
deleteCancelBtn.addEventListener('click', closeDeleteConfirm);
deleteConfirmBtn.addEventListener('click', handleDelete);
qrClose.addEventListener('click', closeQrModal);
qrRefreshBtn.addEventListener('click', async () => {
  qrLoading.textContent = 'Refreshing...';
  qrLoading.classList.remove('hidden');
  await fetchStatus();
  if (currentQrCode) {
    await renderQrCode(currentQrCode);
  }
});

// Click on status to open QR modal when in QR state
statusEl.addEventListener('click', () => {
  if (statusEl.classList.contains('qr')) {
    openQrModal();
    // If we have a QR code, render it
    if (currentQrCode) {
      renderQrCode(currentQrCode);
    }
    // Also fetch fresh status
    fetchStatus();
  }
});

// Close modals on overlay click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
deleteOverlay.addEventListener('click', (e) => {
  if (e.target === deleteOverlay) closeDeleteConfirm();
});
qrOverlay.addEventListener('click', (e) => {
  if (e.target === qrOverlay) closeQrModal();
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteConfirm();
    closeQrModal();
  }
});

// Initial load
fetchJobs();
fetchStatus();

// Auto-refresh status every 5 seconds (faster for QR code updates)
setInterval(fetchStatus, 5000);

// Refresh jobs every 30 seconds
setInterval(fetchJobs, 30000);

