let accessToken = "";

const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const loginForm = document.getElementById("loginForm");
const authStatus = document.getElementById("authStatus");
const loadUsersBtn = document.getElementById("loadUsersBtn");
const loadReportsBtn = document.getElementById("loadReportsBtn");
const usersTbody = document.getElementById("usersTbody");
const allReportsTbody = document.getElementById("allReportsTbody");
const userReportsTbody = document.getElementById("userReportsTbody");
const userReportsTitle = document.getElementById("userReportsTitle");

function getApiBaseUrl() {
  return apiBaseUrlInput.value.trim().replace(/\/+$/, "");
}

function setStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle("error", isError);
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch (_) {
      // noop
    }
    throw new Error(detail);
  }

  return response.json();
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function renderUsers(users) {
  usersTbody.innerHTML = "";
  for (const user of users) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${user.role}</td>
      <td>${user.reports_count}</td>
      <td>${formatDate(user.created_at)}</td>
      <td><button class="inline-btn" data-user-id="${user.id}" data-username="${user.username}">View Reports</button></td>
    `;
    usersTbody.appendChild(tr);
  }

  usersTbody.querySelectorAll("button[data-user-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.userId;
      const username = button.dataset.username;
      await loadReportsByUser(userId, username);
    });
  });
}

function renderAllReports(reports) {
  allReportsTbody.innerHTML = "";
  for (const report of reports) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${report.id}</td>
      <td>${report.username} (#${report.user_id})</td>
      <td>${report.title}</td>
      <td>${report.tokens_used}</td>
      <td>${formatDate(report.created_at)}</td>
      <td><a href="${report.pdf_url}" target="_blank" rel="noopener noreferrer">Download</a></td>
    `;
    allReportsTbody.appendChild(tr);
  }
}

function renderUserReports(reports, username) {
  userReportsTitle.textContent = `Reports By User${username ? `: ${username}` : ""}`;
  userReportsTbody.innerHTML = "";
  for (const report of reports) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${report.id}</td>
      <td>${report.title}</td>
      <td>${formatDate(report.created_at)}</td>
      <td><a href="${report.pdf_url}" target="_blank" rel="noopener noreferrer">Download</a></td>
    `;
    userReportsTbody.appendChild(tr);
  }
}

async function loadUsers() {
  const data = await apiRequest("/admin/users?limit=100&offset=0");
  renderUsers(data.users || []);
}

async function loadAllReports() {
  const data = await apiRequest("/admin/reports?limit=100&offset=0");
  renderAllReports(data.reports || []);
}

async function loadReportsByUser(userId, username) {
  const data = await apiRequest(`/admin/users/${userId}/reports?limit=100&offset=0`);
  renderUserReports(data.reports || [], username);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const tokenData = await apiRequest("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    accessToken = tokenData.access_token;
    setStatus("Authenticated. You can load users/reports.");
  } catch (error) {
    setStatus(`Login failed: ${error.message}`, true);
  }
});

loadUsersBtn.addEventListener("click", async () => {
  try {
    await loadUsers();
  } catch (error) {
    setStatus(`Failed to load users: ${error.message}`, true);
  }
});

loadReportsBtn.addEventListener("click", async () => {
  try {
    await loadAllReports();
  } catch (error) {
    setStatus(`Failed to load reports: ${error.message}`, true);
  }
});
