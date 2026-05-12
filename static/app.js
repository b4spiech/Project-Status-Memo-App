const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("message-form");
const inputEl = document.getElementById("message-input");
const sendBtn = formEl.querySelector('button[type="submit"]');
const generateBtn = document.getElementById("generate-memo");
const overlayEl = document.getElementById("memo-overlay");
const memoContentEl = document.getElementById("memo-content");
const downloadBtn = document.getElementById("download-docx");
const closeBtn = document.getElementById("close-memo");

let currentMemo = null;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function renderMessage(msg) {
  const el = document.createElement("div");
  el.className = `message ${msg.role}`;
  el.innerHTML = `${escapeHtml(msg.content)}<span class="message-timestamp">${escapeHtml(
    formatTimestamp(msg.timestamp)
  )}</span>`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderEmptyState() {
  messagesEl.innerHTML = `
    <div class="empty-state">
      <p>Start a conversation about the Digital Commerce Project.</p>
      <p>Try: "We're in the implementation phase. Schedule is yellow because of integration delays."</p>
    </div>
  `;
}

async function loadHistory() {
  const res = await fetch("/api/messages");
  if (!res.ok) {
    console.error("Failed to load messages");
    return;
  }
  const messages = await res.json();
  messagesEl.innerHTML = "";
  if (messages.length === 0) {
    renderEmptyState();
    return;
  }
  for (const m of messages) renderMessage(m);
}

function showThinking() {
  const el = document.createElement("div");
  el.className = "message assistant thinking";
  el.id = "thinking-indicator";
  el.textContent = "Thinking…";
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function clearThinking() {
  const el = document.getElementById("thinking-indicator");
  if (el) el.remove();
}

async function sendMessage(content) {
  const empty = messagesEl.querySelector(".empty-state");
  if (empty) empty.remove();

  renderMessage({ role: "user", content, timestamp: new Date().toISOString() });
  showThinking();
  sendBtn.disabled = true;
  generateBtn.disabled = true;

  try {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    clearThinking();
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Unknown error" }));
      const errEl = document.createElement("div");
      errEl.className = "error";
      errEl.textContent = `Error: ${err.detail || res.statusText}`;
      messagesEl.appendChild(errEl);
      return;
    }
    const data = await res.json();
    // The optimistically-rendered user message has no id/timestamp from server;
    // replace nothing — just append the assistant reply.
    renderMessage(data.assistant_message);
  } catch (e) {
    clearThinking();
    const errEl = document.createElement("div");
    errEl.className = "error";
    errEl.textContent = `Network error: ${e.message}`;
    messagesEl.appendChild(errEl);
  } finally {
    sendBtn.disabled = false;
    generateBtn.disabled = false;
  }
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const content = inputEl.value.trim();
  if (!content) return;
  inputEl.value = "";
  sendMessage(content);
});

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

function renderMemo(memo) {
  const statusPill = (val) => {
    const v = (val || "").toLowerCase();
    const cls = ["green", "yellow", "red"].includes(v) ? v : "";
    return `<span class="status-pill ${cls}">${escapeHtml(val || "—")}</span>`;
  };

  const row = (label, value) =>
    `<div class="field-row"><div class="field-label">${escapeHtml(
      label
    )}</div><div class="field-value">${value}</div></div>`;

  const statusSection = (title, prefix) => `
    <h3>${escapeHtml(title)}</h3>
    ${row("Status", statusPill(memo[`${prefix}_status`]))}
    ${row("Trend", escapeHtml(memo[`${prefix}_trend`] || "—"))}
    ${row("Notes", escapeHtml(memo[`${prefix}_notes`] || "—"))}
  `;

  const listSection = (title, items) => {
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) {
      return `<h3>${escapeHtml(title)}</h3><p>—</p>`;
    }
    return `<h3>${escapeHtml(title)}</h3><ul>${arr
      .map((i) => `<li>${escapeHtml(i)}</li>`)
      .join("")}</ul>`;
  };

  const risksSection = () => {
    const risks = memo.risks || [];
    if (risks.length === 0) return `<h3>Risks</h3><p>—</p>`;
    return `<h3>Risks</h3>${risks
      .map(
        (r) => `
        <div class="item-card">
          <div class="item-title">${escapeHtml(r.description || "—")}</div>
          <div class="item-meta">Likelihood: ${escapeHtml(
            r.likelihood || "—"
          )} · Impact: ${escapeHtml(r.impact || "—")}</div>
          <div class="item-meta">Mitigation: ${escapeHtml(r.mitigation || "—")}</div>
        </div>`
      )
      .join("")}`;
  };

  const issuesSection = () => {
    const issues = memo.issues || [];
    if (issues.length === 0) return `<h3>Issues</h3><p>—</p>`;
    return `<h3>Issues</h3>${issues
      .map(
        (i) => `
        <div class="item-card">
          <div class="item-title">${escapeHtml(i.description || "—")}</div>
          <div class="item-meta">Raised by: ${escapeHtml(
            i.raised_by || "—"
          )} · Status: ${escapeHtml(i.status || "—")}</div>
          <div class="item-meta">Next step: ${escapeHtml(i.next_step || "—")}</div>
        </div>`
      )
      .join("")}`;
  };

  const decisionsSection = () => {
    const decisions = memo.decisions || [];
    if (decisions.length === 0) return `<h3>Decisions</h3><p>—</p>`;
    return `<h3>Decisions</h3>${decisions
      .map(
        (d) => `
        <div class="item-card">
          <div class="item-title">${escapeHtml(d.description || "—")}</div>
          <div class="item-meta">Made by: ${escapeHtml(
            d.made_by || "—"
          )} · Date: ${escapeHtml(d.date || "—")}</div>
        </div>`
      )
      .join("")}`;
  };

  memoContentEl.innerHTML = `
    <h3>Overview</h3>
    ${row("Report Date", escapeHtml(memo.report_date || "—"))}
    ${row(
      "Reporting Period",
      `${escapeHtml(memo.reporting_period_start || "—")} → ${escapeHtml(
        memo.reporting_period_end || "—"
      )}`
    )}
    ${row("Current Phase", escapeHtml(memo.current_phase || "—"))}
    ${row("Prepared By", escapeHtml(memo.prepared_by || "—"))}

    ${statusSection("Schedule", "schedule")}
    ${statusSection("Scope", "scope")}
    ${statusSection("Resources", "resources")}
    ${statusSection("Vendor", "vendor")}

    ${listSection("Completed", memo.completed_items)}
    ${listSection("In Progress", memo.current_items)}
    ${listSection("Upcoming", memo.upcoming_items)}

    ${risksSection()}
    ${listSection("Assumptions", memo.assumptions)}
    ${issuesSection()}
    ${decisionsSection()}
    ${listSection("Notes", memo.notes)}
  `;
}

generateBtn.addEventListener("click", async () => {
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";
  try {
    const res = await fetch("/api/memo", { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      alert(`Failed to generate memo: ${err.detail || res.statusText}`);
      return;
    }
    currentMemo = await res.json();
    renderMemo(currentMemo);
    overlayEl.classList.remove("hidden");
  } catch (e) {
    alert(`Network error: ${e.message}`);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Memo";
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!currentMemo) return;
  downloadBtn.disabled = true;
  try {
    const res = await fetch("/api/memo/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo: currentMemo }),
    });
    if (!res.ok) {
      alert("Failed to download .docx");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project-status-memo.docx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    downloadBtn.disabled = false;
  }
});

closeBtn.addEventListener("click", () => {
  overlayEl.classList.add("hidden");
});

overlayEl.addEventListener("click", (e) => {
  if (e.target === overlayEl) overlayEl.classList.add("hidden");
});

loadHistory();
