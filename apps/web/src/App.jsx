import React, { useMemo, useState } from "react";

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
const TOKEN_KEY = "chemical_report_web_token";

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });

  const [reportForm, setReportForm] = useState({
    title: "",
    prompt: "",
    chemical_compound: "",
  });

  const [reportIds, setReportIds] = useState([]);
  const [reportDetail, setReportDetail] = useState(null);
  const [creatingReport, setCreatingReport] = useState(false);

  const isAuthenticated = Boolean(token);

  const authHeaders = useMemo(() => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  async function request(path, options = {}) {
    const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...authHeaders,
      },
    });

    const raw = await response.text();
    const data = parseJsonSafe(raw);

    if (!response.ok) {
      const detail = data?.detail || raw || `HTTP ${response.status}`;
      throw new Error(detail);
    }

    return data;
  }

  function resetFeedback(message = "Ready") {
    setError("");
    setStatus(message);
  }

  async function onRegister(event) {
    event.preventDefault();
    resetFeedback("Creating user...");

    try {
      const payload = {
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
      };
      await request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStatus("User created. Now login with that account.");
      setRegisterForm({ username: "", email: "", password: "" });
    } catch (err) {
      setError(`Register failed: ${err.message}`);
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    resetFeedback("Authenticating...");

    try {
      const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      const newToken = data.access_token;
      setToken(newToken);
      localStorage.setItem(TOKEN_KEY, newToken);
      setStatus("Logged in successfully.");
      setLoginForm({ username: "", password: "" });
    } catch (err) {
      setError(`Login failed: ${err.message}`);
    }
  }

  function onLogout() {
    setToken("");
    localStorage.removeItem(TOKEN_KEY);
    setReportIds([]);
    setReportDetail(null);
    setStatus("Logged out.");
    setError("");
  }

  async function onCreateReport(event) {
    event.preventDefault();
    resetFeedback("Generating report...");
    setCreatingReport(true);

    try {
      const created = await request("/reports/generate_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportForm),
      });

      setStatus(`Report #${created.id} created successfully.`);
      setReportForm({ title: "", prompt: "", chemical_compound: "" });
      await onLoadMyReports();
      await onLoadReportDetail(created.id);
    } catch (err) {
      setError(`Create report failed: ${err.message}`);
    } finally {
      setCreatingReport(false);
    }
  }

  async function onLoadMyReports() {
    resetFeedback("Loading your reports...");

    try {
      const data = await request("/reports/list_reports");
      const ids = Array.isArray(data?.ids) ? data.ids : [];
      setReportIds(ids);
      setStatus(`Loaded ${ids.length} reports.`);
    } catch (err) {
      setError(`List reports failed: ${err.message}`);
    }
  }

  async function onLoadReportDetail(reportId) {
    resetFeedback(`Loading report #${reportId}...`);

    try {
      const data = await request(`/reports/${reportId}`);
      setReportDetail(data);
      setStatus(`Report #${reportId} loaded.`);
    } catch (err) {
      setError(`Load report failed: ${err.message}`);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Chemical Reports</h1>
        <div className="api-box">
          <label htmlFor="apiBaseUrl">API</label>
          <input
            id="apiBaseUrl"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:8000/api/v1"
          />
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Create User</h2>
          <form className="form" onSubmit={onRegister}>
            <input
              value={registerForm.username}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="username"
              required
            />
            <input
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="email"
              required
            />
            <input
              type="password"
              value={registerForm.password}
              onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="password"
              minLength={8}
              required
            />
            <button type="submit">Create User</button>
          </form>
        </section>

        <section className="card">
          <h2>Login</h2>
          <form className="form" onSubmit={onLogin}>
            <input
              value={loginForm.username}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="username"
              required
            />
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="password"
              required
            />
            <button type="submit">Login</button>
          </form>
          <div className="auth-row">
            <span>{isAuthenticated ? "Authenticated" : "Not authenticated"}</span>
            <button type="button" className="secondary" onClick={onLogout} disabled={!isAuthenticated}>
              Logout
            </button>
          </div>
        </section>

        <section className="card card-wide">
          <h2>Create Report</h2>
          <form className="form" onSubmit={onCreateReport}>
            <input
              value={reportForm.title}
              onChange={(e) => setReportForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="title"
              required
              disabled={!isAuthenticated || creatingReport}
            />
            <input
              value={reportForm.chemical_compound}
              onChange={(e) => setReportForm((prev) => ({ ...prev, chemical_compound: e.target.value }))}
              placeholder="chemical compound (e.g. H2O)"
              required
              disabled={!isAuthenticated || creatingReport}
            />
            <textarea
              value={reportForm.prompt}
              onChange={(e) => setReportForm((prev) => ({ ...prev, prompt: e.target.value }))}
              placeholder="prompt"
              rows={4}
              required
              disabled={!isAuthenticated || creatingReport}
            />
            <button type="submit" disabled={!isAuthenticated || creatingReport}>
              {creatingReport ? "Generating..." : "Generate Report"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>My Reports</h2>
            <button type="button" onClick={onLoadMyReports} disabled={!isAuthenticated}>
              Refresh
            </button>
          </div>
          <ul className="list">
            {reportIds.map((id) => (
              <li key={id}>
                <button type="button" className="link-btn" onClick={() => onLoadReportDetail(id)}>
                  Report #{id}
                </button>
              </li>
            ))}
            {reportIds.length === 0 && <li>No reports loaded.</li>}
          </ul>
        </section>

        <section className="card card-wide">
          <h2>Report Detail</h2>
          {!reportDetail && <p>Select a report to review its content and metadata.</p>}
          {reportDetail && (
            <article className="report-detail">
              <p><strong>ID:</strong> {reportDetail.id}</p>
              <p><strong>Title:</strong> {reportDetail.title}</p>
              <p><strong>User ID:</strong> {reportDetail.user_id}</p>
              <p><strong>Chemical:</strong> {reportDetail.chemical_compound}</p>
              <p><strong>Created:</strong> {new Date(reportDetail.created_at).toLocaleString()}</p>
              <p><strong>Tokens:</strong> {reportDetail.tokens_used}</p>
              <p>
                <strong>PDF:</strong>{" "}
                <a href={reportDetail.pdf_url} target="_blank" rel="noreferrer">
                  Download
                </a>
              </p>
              <p><strong>Prompt:</strong></p>
              <pre>{reportDetail.prompt}</pre>
              <p><strong>Content:</strong></p>
              <pre>{reportDetail.content}</pre>
            </article>
          )}
        </section>
      </main>

      <footer className="footer">
        <p className="status">Status: {status}</p>
        {error && <p className="error">{error}</p>}
      </footer>
    </div>
  );
}
