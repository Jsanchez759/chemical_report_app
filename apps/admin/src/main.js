import "./styles.css";

const TOKEN_KEY = "chemops_admin_token";

let accessToken = localStorage.getItem(TOKEN_KEY) || "";

const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const sessionInfo = document.getElementById("sessionInfo");

const loadUsersBtn = document.getElementById("loadUsersBtn");
const loadReportsBtn = document.getElementById("loadReportsBtn");
const usersTbody = document.getElementById("usersTbody");
const allReportsTbody = document.getElementById("allReportsTbody");
const userReportsTbody = document.getElementById("userReportsTbody");
const userReportsTitle = document.getElementById("userReportsTitle");

function getApiBaseUrl() {
  return apiBaseUrlInput.value.trim().replace(/\/+$/, "");
}

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle("error", isError);
}

function setDashboardStatus(message, isError = false) {
  dashboardStatus.textContent = message;
  dashboardStatus.classList.toggle("error", isError);
}

function setViewAuthenticated(isAuthenticated) {
  authView.classList.toggle("hidden", isAuthenticated);
  dashboardView.classList.toggle("hidden", !isAuthenticated);
}

function clearTables() {
  usersTbody.innerHTML = "";
  allReportsTbody.innerHTML = "";
  userReportsTbody.innerHTML = "";
  userReportsTitle.textContent = "Reports By User";
}

function logout() {
  accessToken = "";
  localStorage.removeItem(TOKEN_KEY);
  setViewAuthenticated(false);
  clearTables();
  setAuthStatus("Session closed. Login required.");
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

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

    if (response.status === 401 || response.status === 403) {
      logout();
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
      <td>
        <button class="inline-btn" data-user-id="${user.id}" data-username="${user.username}">
          View Reports
        </button>
      </td>
    `;
    usersTbody.appendChild(tr);
  }

  usersTbody.querySelectorAll("button[data-user-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const userId = btn.dataset.userId;
      const username = btn.dataset.username;
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
  userReportsTitle.textContent = `Reports By User: ${username}`;
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
  sessionInfo.textContent = `Authenticated · ${data.total} users total`;
  setDashboardStatus("Users loaded.");
}

async function loadAllReports() {
  const data = await apiRequest("/admin/reports?limit=100&offset=0");
  renderAllReports(data.reports || []);
  setDashboardStatus(`All reports loaded (${data.total} total).`);
}

async function loadReportsByUser(userId, username) {
  const data = await apiRequest(`/admin/users/${userId}/reports?limit=100&offset=0`);
  renderUserReports(data.reports || [], username);
  setDashboardStatus(`Loaded reports for user ${username}.`);
}

async function validateSession() {
  if (!accessToken) {
    setViewAuthenticated(false);
    return;
  }

  try {
    await apiRequest("/admin/users?limit=1&offset=0");
    setViewAuthenticated(true);
    setDashboardStatus("Session restored.");
    await Promise.all([loadUsers(), loadAllReports()]);
  } catch (error) {
    logout();
    setAuthStatus(`Please login again: ${error.message}`, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  loginBtn.disabled = true;
  setAuthStatus("Authenticating...");

  try {
    const tokenData = await apiRequest("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    accessToken = tokenData.access_token;
    localStorage.setItem(TOKEN_KEY, accessToken);

    await apiRequest("/admin/users?limit=1&offset=0");

    setViewAuthenticated(true);
    setDashboardStatus("Welcome. Loading data...");
    await Promise.all([loadUsers(), loadAllReports()]);
  } catch (error) {
    accessToken = "";
    localStorage.removeItem(TOKEN_KEY);
    setAuthStatus(`Login failed: ${error.message}`, true);
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => {
  logout();
});

loadUsersBtn.addEventListener("click", async () => {
  try {
    setDashboardStatus("Loading users...");
    await loadUsers();
  } catch (error) {
    setDashboardStatus(`Failed to load users: ${error.message}`, true);
  }
});

loadReportsBtn.addEventListener("click", async () => {
  try {
    setDashboardStatus("Loading all reports...");
    await loadAllReports();
  } catch (error) {
    setDashboardStatus(`Failed to load reports: ${error.message}`, true);
  }
});

validateSession();
