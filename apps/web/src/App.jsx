import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import logo from './assets/logo.svg';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://chemical-report-app.onrender.com/api/v1').replace(/\/+$/, '');
const TOKEN_KEY = 'chemreport_user_token';
const CHAT_SUGGESTIONS = [
  'Summarize the key findings',
  'What limitations should I consider?',
  'Which conditions affect stability?',
];

function formatDate(value, compact = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', compact
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function Brand({ compact = false }) {
  return (
    <div className={'brand ' + (compact ? 'brand-compact' : '')}>
      <img src={logo} alt="" />
      <span>ChemReport<span className="brand-light"> Studio</span></span>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '');
  const [authTab, setAuthTab] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '' });
  const [reportForm, setReportForm] = useState({ title: '', chemical_compound: '', prompt: '' });
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [view, setView] = useState('new');
  const [search, setSearch] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function request(path, options = {}, tokenOverride = token) {
    const response = await fetch(API_BASE_URL + path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(tokenOverride ? { Authorization: 'Bearer ' + tokenOverride } : {}),
      },
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : raw.slice(0, 150);
      const error = new Error(detail || 'Request failed (' + response.status + ').');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function signOut(message = 'Signed out.') {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setReports([]);
    setSelectedReport(null);
    setChatMessages([]);
    setView('new');
    setError('');
    setStatus(message);
  }

  async function loadChatHistory(reportId, activeToken = token) {
    setChatLoading(true);
    try {
      const data = await request('/reports/' + reportId + '/chat/history?limit=50', {}, activeToken);
      setChatMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (err) {
      setChatMessages([]);
      setError('Could not load this conversation. ' + err.message);
    } finally {
      setChatLoading(false);
    }
  }

  async function openReport(reportId, activeToken = token) {
    setError('');
    setStatus('Opening report…');
    try {
      const data = await request('/reports/' + reportId, {}, activeToken);
      setSelectedReport(data);
      setView('report');
      setLibraryOpen(false);
      setChatInput('');
      await loadChatHistory(reportId, activeToken);
      setStatus('');
    } catch (err) {
      if (err.status === 401) {
        signOut('Your session ended. Sign in again.');
      } else {
        setError('Could not open the report. ' + err.message);
      }
      setStatus('');
    }
  }

  async function loadReports(activeToken = token, preferredId = null) {
    setLibraryLoading(true);
    setError('');
    try {
      const data = await request('/reports/list_reports', {}, activeToken);
      const items = Array.isArray(data?.reports)
        ? data.reports
        : (data?.ids || []).map((id) => ({ id, title: 'Report #' + id, chemical_compound: '', created_at: '' }));
      setReports(items);
      const target = preferredId || selectedReport?.id || items[0]?.id;
      if (target && items.some((item) => item.id === target)) {
        await openReport(target, activeToken);
      } else {
        setSelectedReport(null);
        setView('new');
        setStatus('');
      }
    } catch (err) {
      if (err.status === 401) signOut('Your session ended. Sign in again.');
      else setError('Could not load your reports. ' + err.message);
      setStatus('');
    } finally {
      setLibraryLoading(false);
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      const data = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      }, '');
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setLoginForm({ username: '', password: '' });
      setStatus('Welcome back.');
    } catch (err) {
      setError('Sign in failed. ' + err.message);
    } finally {
      setWorking(false);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      await request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      }, '');
      setRegisterForm({ username: '', email: '', password: '' });
      setAuthTab('login');
      setStatus('Account created. Sign in to continue.');
    } catch (err) {
      setError('Could not create your account. ' + err.message);
    } finally {
      setWorking(false);
    }
  }

  async function createReport(event) {
    event.preventDefault();
    if (!reportForm.title.trim() || !reportForm.chemical_compound.trim() || !reportForm.prompt.trim()) {
      setError('Add a title, compound, and research question before generating a report.');
      return;
    }
    setWorking(true);
    setError('');
    setStatus('Preparing your report. This may take a moment…');
    try {
      const created = await request('/reports/generate_report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reportForm.title.trim(),
          chemical_compound: reportForm.chemical_compound.trim(),
          prompt: reportForm.prompt.trim(),
        }),
      });
      setReportForm({ title: '', chemical_compound: '', prompt: '' });
      await loadReports(token, created.id);
      setStatus('Report created.');
    } catch (err) {
      setError('Could not generate the report. ' + err.message);
      setStatus('');
    } finally {
      setWorking(false);
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!selectedReport?.id || !message || chatSending) return;
    setChatSending(true);
    setError('');
    setChatInput('');
    setChatMessages((items) => [...items, {
      id: 'draft-' + Date.now(), role: 'user', content: message, created_at: new Date().toISOString(),
    }]);
    try {
      const data = await request('/reports/' + selectedReport.id + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      setChatMessages((items) => [...items, {
        id: 'reply-' + Date.now(), role: 'assistant', content: data.answer || '',
        created_at: data.created_at || new Date().toISOString(),
      }]);
    } catch (err) {
      setChatInput(message);
      setError('Could not send your question. ' + err.message);
      await loadChatHistory(selectedReport.id);
    } finally {
      setChatSending(false);
    }
  }

  useEffect(() => {
    if (token) void loadReports(token);
  }, [token]);

  const visibleReports = reports.filter((report) => {
    const query = search.trim().toLowerCase();
    return !query || (report.title + ' ' + report.chemical_compound).toLowerCase().includes(query);
  });

  if (!token) {
    return (
      <div className="auth-shell">
        <section className="auth-story">
          <Brand />
          <div className="auth-story-copy">
            <h1>Turn a chemical question into a clear report.</h1>
            <p>Create a report, return to the evidence, and ask follow-up questions in one focused workspace.</p>
          </div>
          <div className="lab-illustration" aria-hidden="true">
            <div className="illustration-orbit orbit-one" />
            <div className="illustration-orbit orbit-two" />
            <div className="illustration-node node-one" />
            <div className="illustration-node node-two" />
            <div className="illustration-node node-three" />
            <div className="illustration-document">
              <span className="doc-symbol">⌁</span>
              <span className="doc-line wide" /><span className="doc-line" />
              <span className="doc-chart"><i /><i /><i /><i /><i /></span>
              <span className="doc-line short" />
            </div>
          </div>
          <p className="auth-story-foot">A quieter place for rigorous work.</p>
        </section>
        <main className="auth-entry">
          <div className="auth-entry-inner">
            <p className="entry-intro">Your workspace</p>
            <h2>{authTab === 'login' ? 'Welcome back.' : 'Create your account.'}</h2>
            <p className="entry-description">{authTab === 'login'
              ? 'Sign in to open your reports and continue your work.'
              : 'Your reports stay together in a personal workspace.'}</p>
            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected={authTab === 'login'} className={authTab === 'login' ? 'active' : ''} onClick={() => { setAuthTab('login'); setError(''); }}>Sign in</button>
              <button type="button" role="tab" aria-selected={authTab === 'register'} className={authTab === 'register' ? 'active' : ''} onClick={() => { setAuthTab('register'); setError(''); }}>Create account</button>
            </div>
            {authTab === 'login' ? (
              <form className="auth-form" onSubmit={submitLogin}>
                <label htmlFor="login-username">Username</label>
                <input id="login-username" autoComplete="username" required value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Your username" />
                <label htmlFor="login-password">Password</label>
                <input id="login-password" type="password" autoComplete="current-password" required value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Your password" />
                <button className="button button-primary" type="submit" disabled={working}>{working ? 'Signing in…' : 'Sign in'}</button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={submitRegister}>
                <label htmlFor="register-username">Username</label>
                <input id="register-username" autoComplete="username" required value={registerForm.username} onChange={(event) => setRegisterForm({ ...registerForm, username: event.target.value })} placeholder="Choose a username" />
                <label htmlFor="register-email">Email address</label>
                <input id="register-email" type="email" autoComplete="email" required value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} placeholder="you@example.com" />
                <label htmlFor="register-password">Password</label>
                <input id="register-password" type="password" autoComplete="new-password" minLength={8} required value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} placeholder="At least 8 characters" />
                <button className="button button-primary" type="submit" disabled={working}>{working ? 'Creating account…' : 'Create account'}</button>
              </form>
            )}
            <div className="feedback" role="status" aria-live="polite">{error ? <p className="error">{error}</p> : status ? <p>{status}</p> : null}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <button type="button" className="library-toggle" aria-expanded={libraryOpen} onClick={() => setLibraryOpen(!libraryOpen)}>Reports</button>
          <Brand compact />
          <span className="workspace-label">Research workspace</span>
        </div>
        <div className="app-header-actions">
          <button type="button" className="button button-quiet" onClick={() => { setView('new'); setLibraryOpen(false); setError(''); }}>New report</button>
          <button type="button" className="signout-button" onClick={() => signOut()}>Sign out</button>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className={'report-library ' + (libraryOpen ? 'is-open' : '')} aria-label="Report library">
          <div className="library-heading"><div><h2>Library</h2><p>{reports.length} {reports.length === 1 ? 'report' : 'reports'}</p></div><button type="button" aria-label="Refresh reports" onClick={() => loadReports()} disabled={libraryLoading}>↻</button></div>
          <label className="search-label" htmlFor="report-search">Find a report</label>
          <input id="report-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or compound" />
          {libraryLoading && <p className="library-note">Loading reports…</p>}
          {!libraryLoading && reports.length === 0 && <div className="library-empty"><span>⌁</span><p>No reports yet.</p><button type="button" onClick={() => { setView('new'); setLibraryOpen(false); }}>Create your first report</button></div>}
          {!libraryLoading && reports.length > 0 && visibleReports.length === 0 && <p className="library-note">No report matches that search.</p>}
          <div className="report-list">
            {visibleReports.map((report) => (
              <button type="button" key={report.id} className={'report-list-item ' + (view === 'report' && selectedReport?.id === report.id ? 'selected' : '')} onClick={() => openReport(report.id)}>
                <span className="report-list-title">{report.title}</span>
                <span className="report-list-meta">{report.chemical_compound || 'Chemical report'} <span>{formatDate(report.created_at, true)}</span></span>
              </button>
            ))}
          </div>
          <div className="library-bottom">Your reports and conversations stay together here.</div>
        </aside>

        <main className="workspace-main">
          {error && <div className="app-notice error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          {status && <div className="app-notice" role="status">{status}</div>}

          {view === 'new' || !selectedReport ? (
            <div className="create-layout">
              <section className="create-main">
                <p className="page-label">New report</p>
                <h1>Start with a compound.</h1>
                <p className="page-description">Give the report a clear question to investigate. You can read the result, save the PDF, and continue with follow-up questions.</p>
                <form className="report-form" onSubmit={createReport}>
                  <div className="form-row">
                    <label htmlFor="report-title">Report title<span>What should you recognize later?</span></label>
                    <input id="report-title" maxLength={255} required disabled={working} value={reportForm.title} onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })} placeholder="e.g. Glucose stability review" />
                  </div>
                  <div className="form-row">
                    <label htmlFor="compound">Chemical compound<span>Name or formula</span></label>
                    <input id="compound" maxLength={255} required disabled={working} value={reportForm.chemical_compound} onChange={(event) => setReportForm({ ...reportForm, chemical_compound: event.target.value })} placeholder="e.g. C6H12O6" />
                  </div>
                  <div className="form-row">
                    <label htmlFor="report-prompt">Research question<span>Describe the focus and the level of detail you need.</span></label>
                    <textarea id="report-prompt" maxLength={4000} rows={8} required disabled={working} value={reportForm.prompt} onChange={(event) => setReportForm({ ...reportForm, prompt: event.target.value })} placeholder="Examine stability in aqueous solution at room temperature. Include relevant conditions, limitations, and sources of uncertainty." />
                    <span className="character-count">{reportForm.prompt.length} / 4000</span>
                  </div>
                  <button type="submit" className="button button-primary" disabled={working}>{working ? 'Preparing report…' : 'Generate report'}</button>
                </form>
              </section>
              <aside className="create-guide">
                <div className="guide-graphic" aria-hidden="true"><span className="guide-orbit" /><span className="guide-dot" /><span className="guide-dot second" /><span className="guide-dot third" /></div>
                <h2>A useful question is specific.</h2>
                <p>Include the compound, conditions, and what you want to understand. Mention temperature, medium, or application when they matter.</p>
                <div className="guide-divider" />
                <strong>Example focus</strong>
                <p>“Compare known degradation pathways for this compound in water and identify conditions that affect shelf life.”</p>
              </aside>
            </div>
          ) : (
            <div className="report-layout">
              <article className="report-reader">
                <div className="report-heading">
                  <p className="page-label">Report <span>#{selectedReport.id}</span></p>
                  <h1>{selectedReport.title}</h1>
                  <div className="report-meta"><span>{selectedReport.chemical_compound}</span><span>{formatDate(selectedReport.created_at)}</span></div>
                  {selectedReport.pdf_url && <a className="button button-primary" href={selectedReport.pdf_url} target="_blank" rel="noreferrer">Open PDF</a>}
                </div>
                <details className="prompt-details"><summary>Research question</summary><p>{selectedReport.prompt}</p></details>
                <div className="reader-body markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedReport.content || ''}</ReactMarkdown></div>
              </article>
              <aside className="report-chat" aria-label="Questions about this report">
                <div className="chat-heading">
                  <div>
                    <p className="chat-eyebrow">REPORT ASSISTANT</p>
                    <h2>Explore this report</h2>
                    <p>Answers are grounded in the report shown here.</p>
                  </div>
                  <span className="chat-spark" aria-hidden="true">✳</span>
                </div>
                <div className="chat-thread" aria-live="polite">
                  {chatLoading && <p className="chat-empty">Loading conversation…</p>}
                  {!chatLoading && chatMessages.length === 0 && <div className="chat-empty">
                    <span className="chat-empty-icon" aria-hidden="true">↗</span>
                    <strong>What would you like to understand?</strong>
                    <p>Ask a follow-up about the findings, evidence, or limitations in this report.</p>
                    <div className="chat-suggestions" aria-label="Suggested questions">
                      {CHAT_SUGGESTIONS.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => setChatInput(suggestion)} disabled={chatSending}>{suggestion}</button>
                      ))}
                    </div>
                  </div>}
                  {chatMessages.map((message) => (
                    <div key={message.id} className={'chat-message ' + (message.role === 'assistant' ? 'assistant' : 'user')}>
                      <div className="chat-message-meta"><strong>{message.role === 'assistant' ? 'Report assistant' : 'You'}</strong><time>{formatDate(message.created_at, true)}</time></div>
                      <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown></div>
                    </div>
                  ))}
                  {chatSending && <div className="chat-message assistant chat-typing" role="status" aria-label="Preparing an answer"><div className="chat-message-meta"><strong>Report assistant</strong><span>Preparing answer</span></div><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span></div>}
                </div>
                <form className="chat-composer" onSubmit={sendChat}>
                  <label htmlFor="chat-question">Ask a follow-up</label>
                  <textarea id="chat-question" rows={3} maxLength={1200} value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Ask about a finding, method, or limitation…" disabled={chatSending} />
                  <div className="chat-composer-footer">
                    <span className="chat-character-count">{chatInput.length} / 1200</span>
                    <button type="submit" className="button button-primary" disabled={chatSending || !chatInput.trim()}>{chatSending ? 'Thinking…' : 'Send question'}<span aria-hidden="true"> ↗</span></button>
                  </div>
                </form>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
