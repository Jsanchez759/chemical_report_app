import "./styles.css";

const TOKEN_KEY = "chemops_admin_token";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://chemical-report-app.onrender.com/api/v1";

let accessToken = localStorage.getItem(TOKEN_KEY) || "";

const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authStatus = document.getElementById("authStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const sessionInfo = document.getElementById("sessionInfo");
const usersCount = document.getElementById("usersCount");
const reportsCount = document.getElementById("reportsCount");

const loadUsersBtn = document.getElementById("loadUsersBtn");
const loadReportsBtn = document.getElementById("loadReportsBtn");
const usersTbody = document.getElementById("usersTbody");
const allReportsTbody = document.getElementById("allReportsTbody");
const userReportsTbody = document.getElementById("userReportsTbody");
const userReportsTitle = document.getElementById("userReportsTitle");

function getApiBaseUrl() {
  return API_BASE_URL.trim().replace(/\/+$/, "");
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
  userReportsTitle.textContent = "Reports by user";
  usersCount.textContent = "—";
  reportsCount.textContent = "—";
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

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "—" : String(value);
  row.appendChild(cell);
  return cell;
}

function appendPdfCell(row, value) {
  const cell = document.createElement("td");
  try {
    if (!value) throw new Error("Missing PDF URL");
    const url = new URL(value, getApiBaseUrl());
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported URL");
    const link = document.createElement("a");
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open PDF";
    cell.appendChild(link);
  } catch {
    cell.textContent = "—";
  }
  row.appendChild(cell);
}

function appendEmptyRow(tbody, columns, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columns;
  cell.className = "empty-cell";
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function renderUsers(users) {
  usersTbody.innerHTML = "";

  for (const user of users) {
    const tr = document.createElement("tr");
    appendCell(tr, user.id);
    appendCell(tr, user.username);
    appendCell(tr, user.email);
    appendCell(tr, user.role);
    appendCell(tr, user.reports_count);
    appendCell(tr, formatDate(user.created_at));
    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.className = "inline-btn";
    button.type = "button";
    button.textContent = "View reports";
    button.addEventListener("click", async () => {
      try {
        await loadReportsByUser(user.id, user.username);
      } catch (error) {
        setDashboardStatus("Could not load this user's reports: " + error.message, true);
      }
    });
    actionCell.appendChild(button);
    tr.appendChild(actionCell);
    usersTbody.appendChild(tr);
  }
  if (users.length === 0) appendEmptyRow(usersTbody, 7, "No users to show.");
}

function renderAllReports(reports) {
  allReportsTbody.innerHTML = "";

  for (const report of reports) {
    const tr = document.createElement("tr");
    appendCell(tr, report.id);
    appendCell(tr, report.username + " (#" + report.user_id + ")");
    appendCell(tr, report.title);
    appendCell(tr, report.tokens_used + " words");
    appendCell(tr, formatDate(report.created_at));
    appendPdfCell(tr, report.pdf_url);
    allReportsTbody.appendChild(tr);
  }
  if (reports.length === 0) appendEmptyRow(allReportsTbody, 6, "No reports to show.");
}

function renderUserReports(reports, username) {
  userReportsTitle.textContent = "Reports by " + username;
  userReportsTbody.innerHTML = "";

  for (const report of reports) {
    const tr = document.createElement("tr");
    appendCell(tr, report.id);
    appendCell(tr, report.title);
    appendCell(tr, formatDate(report.created_at));
    appendPdfCell(tr, report.pdf_url);
    userReportsTbody.appendChild(tr);
  }
  if (reports.length === 0) appendEmptyRow(userReportsTbody, 4, "This user has no reports.");
}

async function loadUsers() {
  const data = await apiRequest("/admin/users?limit=100&offset=0");
  renderUsers(data.users || []);
  usersCount.textContent = data.total;
  sessionInfo.textContent = "Admin workspace";
  setDashboardStatus("Users loaded.");
}

async function loadAllReports() {
  const data = await apiRequest("/admin/reports?limit=100&offset=0");
  renderAllReports(data.reports || []);
  reportsCount.textContent = data.total;
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
