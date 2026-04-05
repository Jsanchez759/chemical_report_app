import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import logo from "./assets/logo.svg";

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1";
const TOKEN_KEY = "chemreport_user_token";

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  const [status, setStatus] = useState("Ready.");
  const [error, setError] = useState("");
  const [activeAuthTab, setActiveAuthTab] = useState("login");

  const [registerForm, setRegisterForm] = useState({ username: "", email: "", password: "" });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  const [reportForm, setReportForm] = useState({
    title: "",
    prompt: "",
    chemical_compound: "",
  });

  const [reportIds, setReportIds] = useState([]);
  const [reportDetail, setReportDetail] = useState(null);
  const [isWorking, setIsWorking] = useState(false);

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

  function setFeedback(nextStatus, nextError = "") {
    setStatus(nextStatus);
    setError(nextError);
  }

  function onLogout() {
    setToken("");
    localStorage.removeItem(TOKEN_KEY);
    setReportIds([]);
    setReportDetail(null);
    setFeedback("Session closed.");
  }

  async function onRegister(event) {
    event.preventDefault();
    setIsWorking(true);
    setFeedback("Creating account...");

    try {
      await request("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerForm),
      });
      setRegisterForm({ username: "", email: "", password: "" });
      setActiveAuthTab("login");
      setFeedback("Account created. Please sign in.");
    } catch (err) {
      setFeedback(status, `Register failed: ${err.message}`);
    } finally {
      setIsWorking(false);
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    setIsWorking(true);
    setFeedback("Signing in...");

    try {
      const data = await request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      const newToken = data.access_token;
      setToken(newToken);
      localStorage.setItem(TOKEN_KEY, newToken);
      setLoginForm({ username: "", password: "" });
      setFeedback("Welcome. Loading reports...");
      await onLoadMyReports(newToken);
    } catch (err) {
      setFeedback(status, `Login failed: ${err.message}`);
    } finally {
      setIsWorking(false);
    }
  }

  async function onLoadMyReports(tokenOverride = null) {
    const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : authHeaders;
    setFeedback("Loading your reports...");

    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/reports/list_reports`, {
        headers,
      });
      const raw = await response.text();
      const data = parseJsonSafe(raw);
      if (!response.ok) {
        throw new Error(data?.detail || raw || `HTTP ${response.status}`);
      }

      const ids = Array.isArray(data?.ids) ? data.ids : [];
      setReportIds(ids);
      setFeedback(`Loaded ${ids.length} reports.`);
      if (ids.length > 0) {
        await onLoadReportDetail(ids[0], tokenOverride);
      }
    } catch (err) {
      setFeedback(status, `List reports failed: ${err.message}`);
    }
  }

  async function onLoadReportDetail(reportId, tokenOverride = null) {
    const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : authHeaders;
    setFeedback(`Loading report #${reportId}...`);

    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/reports/${reportId}`, {
        headers,
      });
      const raw = await response.text();
      const data = parseJsonSafe(raw);
      if (!response.ok) {
        throw new Error(data?.detail || raw || `HTTP ${response.status}`);
      }
      setReportDetail(data);
      setFeedback(`Report #${reportId} ready.`);
    } catch (err) {
      setFeedback(status, `Load report failed: ${err.message}`);
    }
  }

  async function onCreateReport(event) {
    event.preventDefault();
    setIsWorking(true);
    setFeedback("Generating report. Please wait...");

    try {
      const created = await request("/reports/generate_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportForm),
      });

      setReportForm({ title: "", prompt: "", chemical_compound: "" });
      setFeedback(`Report #${created.id} created.`);
      await onLoadMyReports();
      await onLoadReportDetail(created.id);
    } catch (err) {
      setFeedback(status, `Create report failed: ${err.message}`);
    } finally {
      setIsWorking(false);
    }
  }

  useEffect(() => {
    if (token) {
      onLoadMyReports();
    }
  }, [token]);

  if (!isAuthenticated) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="brand-side">
            <img src={logo} alt="ChemReport logo" className="brand-logo" />
            <p className="kicker">Chemical Intelligence</p>
            <h1>ChemReport Studio</h1>
            <p className="subtitle">Generate, store, and review your chemical reports in one workspace.</p>
          </div>

          <div className="auth-side">
            <div className="api-group">
              <label htmlFor="apiBaseUrl">API Base URL</label>
              <input
                id="apiBaseUrl"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/api/v1"
              />
            </div>

            <div className="tabs">
              <button
                type="button"
                className={activeAuthTab === "login" ? "tab active" : "tab"}
                onClick={() => setActiveAuthTab("login")}
              >
                Sign In
              </button>
              <button
                type="button"
                className={activeAuthTab === "register" ? "tab active" : "tab"}
                onClick={() => setActiveAuthTab("register")}
              >
                Create Account
              </button>
            </div>

            {activeAuthTab === "login" ? (
              <form className="form" onSubmit={onLogin}>
                <label>Username</label>
                <input
                  value={loginForm.username}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="username"
                  required
                />
                <label>Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="password"
                  required
                />
                <button type="submit" disabled={isWorking}>
                  {isWorking ? "Signing In..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form className="form" onSubmit={onRegister}>
                <label>Username</label>
                <input
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))}
                  placeholder="username"
                  required
                />
                <label>Email</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email"
                  required
                />
                <label>Password</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="password"
                  minLength={8}
                  required
                />
                <button type="submit" disabled={isWorking}>
                  {isWorking ? "Creating..." : "Create Account"}
                </button>
              </form>
            )}

            <p className="status">{status}</p>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-topbar">
        <div className="brand-inline">
          <img src={logo} alt="ChemReport logo" className="brand-logo-small" />
          <div>
            <p className="kicker">Chemical Intelligence</p>
            <h2>ChemReport Studio</h2>
          </div>
        </div>
        <div className="top-actions">
          <button className="secondary" type="button" onClick={() => onLoadMyReports()}>
            Refresh Reports
          </button>
          <button className="danger" type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="panel panel-wide">
          <div className="panel-head">
            <h3>Create New Report</h3>
          </div>
          <form className="form" onSubmit={onCreateReport}>
            <label>Title</label>
            <input
              value={reportForm.title}
              onChange={(e) => setReportForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Glucose Stability Analysis"
              required
              disabled={isWorking}
            />
            <label>Chemical Compound</label>
            <input
              value={reportForm.chemical_compound}
              onChange={(e) => setReportForm((prev) => ({ ...prev, chemical_compound: e.target.value }))}
              placeholder="e.g. C6H12O6"
              required
              disabled={isWorking}
            />
            <label>Prompt</label>
            <textarea
              value={reportForm.prompt}
              onChange={(e) => setReportForm((prev) => ({ ...prev, prompt: e.target.value }))}
              placeholder="Write what you need from the report"
              rows={5}
              required
              disabled={isWorking}
            />
            <button type="submit" disabled={isWorking}>
              {isWorking ? "Generating..." : "Generate Report"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>My Reports</h3>
          </div>
          <ul className="list">
            {reportIds.map((id) => (
              <li key={id}>
                <button type="button" className="link-btn" onClick={() => onLoadReportDetail(id)}>
                  Report #{id}
                </button>
              </li>
            ))}
            {reportIds.length === 0 && <li>No reports yet.</li>}
          </ul>
        </section>

        <section className="panel panel-wide">
          <div className="panel-head">
            <h3>Report Review</h3>
          </div>
          {!reportDetail && <p>Select a report ID from the list to review previous report data.</p>}
          {reportDetail && (
            <article className="report-detail">
              <p><strong>ID:</strong> {reportDetail.id}</p>
              <p><strong>Title:</strong> {reportDetail.title}</p>
              <p><strong>Chemical:</strong> {reportDetail.chemical_compound}</p>
              <p><strong>Created:</strong> {formatDate(reportDetail.created_at)}</p>
              <p><strong>Tokens:</strong> {reportDetail.tokens_used}</p>
              <p>
                <strong>PDF:</strong>{" "}
                <a href={reportDetail.pdf_url} target="_blank" rel="noreferrer">
                  Download
                </a>
              </p>
              <h4>Prompt</h4>
              <div className="markdown-body prompt-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reportDetail.prompt || ""}
                </ReactMarkdown>
              </div>
              <h4>Content</h4>
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reportDetail.content || ""}
                </ReactMarkdown>
              </div>
            </article>
          )}
        </section>
      </main>

      <footer className="dashboard-footer">
        <p className="status">{status}</p>
        {error && <p className="error">{error}</p>}
      </footer>
    </div>
  );
}
