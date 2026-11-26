const root = document.querySelector("#plan-limits");

const SERVICE_META = {
  "claude-subscription": { mark: "C", color: "#ff8a4c" },
  "anthropic-api": { mark: "C", color: "#ff8a4c" },
  "codex-subscription": { mark: "O", color: "#10d49c" },
  "openai-api": { mark: "O", color: "#10d49c" },
  bedrock: { mark: "A", color: "#ffb454" },
};

const STATUS_LABEL = {
  live: "live",
  stale: "stale",
  unavailable: "unavailable",
  not_applicable: "not applicable",
  not_configured: "not configured",
  error: "error",
};

let state = {
  data: null,
  loading: true,
  refreshing: false,
  refreshError: null,
};

function render() {
  const services = Array.isArray(state.data?.services) ? state.data.services : [];
  root.innerHTML = `
    <section class="plan-usage" aria-labelledby="plan-usage-title">
      <div class="plan-usage-heading">
        <div>
          <div class="plan-usage-kicker">live usage</div>
          <h2 id="plan-usage-title">Plan limits &amp; windows</h2>
        </div>
        <div class="plan-usage-actions">
          <span class="plan-usage-sync">${state.data?.generatedAt ? `sync · ${shortTime(state.data.generatedAt)}` : "sync"}</span>
          <button class="plan-refresh" ${state.refreshing ? "disabled" : ""}>
            <span class="plan-refresh-icon ${state.refreshing ? "spinning" : ""}">↻</span>
            ${state.refreshing ? "refreshing…" : "refresh"}
          </button>
        </div>
      </div>

      ${state.refreshError ? `<div class="plan-refresh-error">${escapeHtml(state.refreshError)}</div>` : ""}

      <div class="plan-services">
        ${state.loading && services.length === 0
          ? `<div class="plan-empty">Loading host plan limits…</div>`
          : services.length === 0
            ? `<div class="plan-empty">No host plan-limit services were reported. See the setup guide in README.md.</div>`
            : services.map(serviceRow).join("")}
      </div>

      <div class="plan-usage-footnote">
        Subscription windows come from Anthropic's observed usage integration and Codex's local App Server.
        A recent Codex rollout is used only as a stale fallback. API-key and Bedrock channels are shown
        separately without invented subscription quotas.
      </div>
    </section>
  `;
  root.querySelector(".plan-refresh")?.addEventListener("click", () => load(true));
}

function serviceRow(service) {
  const meta = SERVICE_META[service.id] ?? { mark: "?", color: "#7a9fff" };
  const windows = Array.isArray(service.windows) ? service.windows : [];
  const status = STATUS_LABEL[service.status] ?? service.status ?? "unknown";
  return `
    <div class="plan-service" style="--service-color:${meta.color}">
      <div class="plan-service-identity">
        ${usageDial(windows)}
        <div class="plan-service-copy">
          <div class="plan-service-name-row">
            <span class="plan-service-mark" aria-hidden="true">${meta.mark}</span>
            <strong>${escapeHtml(service.name ?? "Unknown service")}</strong>
          </div>
          <div class="plan-service-plan">${escapeHtml(service.plan ?? "No plan detected")}</div>
          <div class="plan-service-meta">
            <span class="plan-status plan-status-${safeToken(service.status)}">${escapeHtml(status)}</span>
            <span>${escapeHtml(authLabel(service.authMode))}</span>
          </div>
        </div>
      </div>

      <div class="plan-window-list">
        ${windows.length > 0
          ? windows.map(windowBar).join("")
          : `<div class="plan-service-note">${escapeHtml(service.note ?? "No plan windows reported.")}</div>`}
        ${windows.length > 0 && service.note
          ? `<div class="plan-service-note plan-service-note-inline">${escapeHtml(service.note)}</div>`
          : ""}
        ${service.observedAt
          ? `<div class="plan-observed">observed ${escapeHtml(relativeTime(service.observedAt))}</div>`
          : ""}
      </div>
    </div>
  `;
}

function usageDial(windows) {
  const values = windows
    .map(window => Number(window.usedPct))
    .filter(Number.isFinite);
  const hasUsage = values.length > 0;
  const clamped = hasUsage ? clamp(Math.max(...values), 0, 100) : 0;
  const size = 76;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  return `
    <div class="plan-dial ${hasUsage ? "" : "plan-dial-unknown"}">
      <svg class="plan-dial-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="plan-dial-track" cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke-width="${stroke}"></circle>
        ${hasUsage
          ? `<circle class="plan-dial-progress" cx="${size / 2}" cy="${size / 2}" r="${radius}"
              stroke="var(--service-color)" stroke-width="${stroke}" stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"></circle>`
          : ""}
      </svg>
      <div class="plan-dial-inner">
        <svg class="plan-dial-gauge" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
          <path d="m12 14 4-4"></path>
        </svg>
        <div class="plan-dial-value">${hasUsage ? `${Math.round(clamped)}%` : "—"}</div>
      </div>
    </div>
  `;
}

function windowBar(window) {
  const rawUsed = Number(window.usedPct);
  const used = Number.isFinite(rawUsed) ? clamp(rawUsed, 0, 100) : 0;
  const resetTitle = validDate(window.resetsAt)
    ? `Resets ${new Date(window.resetsAt).toLocaleString()}`
    : "";
  const pace = Number.isFinite(Number(window.pacePct))
    ? `<span class="plan-pace">pace ${Math.round(Number(window.pacePct))}%</span>`
    : "";
  return `
    <div class="plan-window">
      <div class="plan-window-top">
        <div class="plan-window-label">
          <span>${escapeHtml(window.label ?? "Window")}</span>
          <strong>${Math.round(rawUsed)}%</strong>
        </div>
        <div class="plan-window-detail">
          ${validDate(window.resetsAt) ? `resets ${escapeHtml(relativeFuture(window.resetsAt))}` : "reset unknown"}
          ${pace}
        </div>
      </div>
      <div class="plan-window-track" ${resetTitle ? `title="${escapeHtml(resetTitle)}"` : ""}>
        <div class="plan-window-fill" style="width:${used}%"></div>
        <i></i><i></i><i></i>
      </div>
    </div>
  `;
}

async function load(force = false) {
  if (force) state.refreshing = true;
  else state.loading = true;
  state.refreshError = null;
  render();
  try {
    const response = await fetch(`/api/usage/limits${force ? "?refresh=1" : ""}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (error) {
    state.refreshError = `Plan-limit sync failed (${error instanceof Error ? error.message : "unknown error"}). Showing the last successful sync, if available.`;
  } finally {
    state.loading = false;
    state.refreshing = false;
    render();
  }
}

function authLabel(mode) {
  if (mode === "oauth") return "OAuth";
  if (mode === "subscription") return "subscription";
  if (mode === "api_key") return "API key";
  if (mode === "bedrock") return "AWS";
  return "host";
}

function shortTime(iso) {
  return validDate(iso)
    ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "unknown";
}

function relativeTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "at an unknown time";
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}

function relativeFuture(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "unknown";
  if (ms <= 0) return "now";
  if (ms < 3_600_000) return `in ${Math.max(1, Math.round(ms / 60_000))}m`;
  if (ms < 172_800_000) return `in ${Math.round(ms / 3_600_000)}h`;
  return `in ${Math.round(ms / 86_400_000)}d`;
}

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function safeToken(value) {
  return String(value ?? "unknown").replace(/[^a-z0-9_-]/gi, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

render();
load();
setInterval(() => load(false), 60_000);
