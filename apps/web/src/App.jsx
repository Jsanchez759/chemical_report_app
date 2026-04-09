import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import logo from "./assets/logo.svg";

const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://chemical-report-app.onrender.com/api/v1";
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
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);

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
    setChatMessages([]);
    setChatInput("");
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
      await onLoadChatHistory(reportId, tokenOverride);
      setFeedback(`Report #${reportId} ready.`);
    } catch (err) {
      setFeedback(status, `Load report failed: ${err.message}`);
    }
  }

  async function onLoadChatHistory(reportId, tokenOverride = null) {
    const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : authHeaders;
    setChatLoading(true);

    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, "")}/reports/${reportId}/chat/history?limit=50`,
        { headers }
      );
      const raw = await response.text();
      const data = parseJsonSafe(raw);
      if (!response.ok) {
        throw new Error(data?.detail || raw || `HTTP ${response.status}`);
      }
      setChatMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (err) {
      setChatMessages([]);
      setFeedback(status, `Load chat history failed: ${err.message}`);
    } finally {
      setChatLoading(false);
    }
  }

  async function onSendChatMessage(event) {
    event.preventDefault();
    if (!reportDetail?.id || !chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatSending(true);
    setChatInput("");
    setFeedback("Sending chat message...");

    try {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `tmp-user-${Date.now()}`,
          role: "user",
          content: userText,
          created_at: new Date().toISOString(),
        },
      ]);

      const data = await request(`/reports/${reportDetail.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `tmp-assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer || "",
          created_at: data.created_at || new Date().toISOString(),
        },
      ]);
      setFeedback("Chat response received.");
    } catch (err) {
      setFeedback(status, `Chat failed: ${err.message}`);
      await onLoadChatHistory(reportDetail.id);
    } finally {
      setChatSending(false);
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

      <main className="workspace-grid">
        <aside className="panel panel-left">
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
        </aside>

        <section className="panel panel-center">
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

              <h4>Chat About This Report</h4>
              <div className="chat-panel">
                <div className="chat-messages">
                  {chatLoading && <p className="status">Loading chat history...</p>}
                  {!chatLoading && chatMessages.length === 0 && (
                    <p className="status">No messages yet. Ask something about this report.</p>
                  )}
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={message.role === "assistant" ? "chat-message assistant" : "chat-message user"}
                    >
                      <div className="chat-meta">
                        <strong>{message.role === "assistant" ? "Assistant" : "You"}</strong>
                        <span>{formatDate(message.created_at)}</span>
                      </div>
                      <div className="chat-content markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>

                <form className="chat-form" onSubmit={onSendChatMessage}>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question about this report..."
                    rows={3}
                    disabled={chatSending}
                  />
                  <button type="submit" disabled={chatSending || !chatInput.trim()}>
                    {chatSending ? "Sending..." : "Send Message"}
                  </button>
                </form>
              </div>
            </article>
          )}
        </section>

        <aside className="panel panel-right">
          <div className="panel-head">
            <h3>My Reports</h3>
            <button type="button" className="secondary" onClick={() => onLoadMyReports()}>
              Refresh
            </button>
          </div>
          <p className="status">Total: {reportIds.length}</p>
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
        </aside>
      </main>

      <footer className="dashboard-footer">
        <p className="status">{status}</p>
        {error && <p className="error">{error}</p>}
      </footer>
    </div>
  );
}
