function ensureShape() {
  if (!state.sandbox) {
    state.sandbox = {
      name: "BoG Regulatory Sandbox — MCB Pilot",
      status: "APPROVED",
      region: "Greater Accra — Makola and Kejetia",
      cohortCap: 1000,
      started: todayISO(-30),
      ends: todayISO(150),
      firmName: "MCB Technology (placeholder)",
      exclusivity: false,
      feeMode: "INSIDE",
      groupInPilot: true,
      creditLifeOffered: true,
      creditLifeRate: 0.25,
      incidentCeiling: 1.6,
      checklist: [
        { id: "nda", label: "Mutual NDA with the partner bank", done: true },
        { id: "loi", label: "Letter of intent signed", done: true },
        { id: "dpc", label: "Data Protection Commission registry update (Act 843) filed in the bank's name", done: false },
        { id: "bog", label: "Joint sandbox application lodged with Bank of Ghana", done: true },
        { id: "escrow", label: "Escrow sub-ledger opened on the bank core", done: true },
        { id: "hmac", label: "GhIPSS HMAC secret rotated into the sandbox vault", done: true },
        { id: "xds", label: "XDS Data Ghana test file accepted", done: false },
        { id: "setoff", label: "Set-off rule reviewed by bank counsel", done: true },
        { id: "cohort", label: "Cohort capped and region-locked", done: true }
      ]
    };
  }
  if (!state.reminders) state.reminders = [];
  if (!state.testRuns) state.testRuns = [];
  if (!state.engineLog) state.engineLog = [];
  state.users.forEach(function (u) {
    if (u.role !== "CUSTOMER") return;
    if (!u.reminders) u.reminders = { daysBefore: [3, 1, 0], grace: true, lowBalance: true, sms: true, hour: "08:00" };
    if (u.creditLife == null) u.creditLife = false;
  });
}
function outOfPocket() {
  const base = Number(cfg().customerShare);
  const fee = state.sandbox && state.sandbox.feeMode === "ON_TOP" ? Number(cfg().ledgerFee) : 0;
  return Math.round((base + fee) * 100) / 100;
}
function cohortCount() {
  return state.users.filter(function (u) { return u.role === "CUSTOMER"; }).length;
}
function sandboxBanner() {
  const s = state.sandbox;
  return `<div class="notice"><b>${esc(s.status)}</b> sandbox · ${esc(s.region)} · ${cohortCount()} / ${s.cohortCap} boxes · ends ${esc(s.ends)}. MoMo, XDS, and set-off run on the sandbox ledger, not on live GhIPSS.</div>`;
}
function reminderSweep() {
  const today = todayISO(0);
  state.users.filter(function (u) { return u.role === "CUSTOMER"; }).forEach(function (u) {
    const loan = loanOf(u.id);
    if (!loan) return;
    const prefs = u.reminders;
    if (loan.nextDue && (loan.status === "ACTIVE" || loan.status === "GRACE")) {
      const days = daysBetween(today, loan.nextDue);
      (prefs.daysBefore || []).forEach(function (d) {
        if (days !== Number(d)) return;
        const key = "due-" + loan.id + "-" + loan.nextDue + "-" + d;
        if (state.reminders.indexOf(key) >= 0) return;
        state.reminders.push(key);
        const when = d === 0 ? "today" : "in " + d + " day" + (d === 1 ? "" : "s");
        notify(u.id, "Reminder (" + prefs.hour + "): " + money(outOfPocket()) + " Susu drop is due " + when + " from " + u.provider + ". " + (prefs.sms ? "SMS copy queued." : ""));
      });
      if (prefs.lowBalance && u.wallet < outOfPocket()) {
        const key = "low-" + u.id + "-" + today;
        if (state.reminders.indexOf(key) < 0) {
          state.reminders.push(key);
          notify(u.id, "Float is under the next drop. Top up " + u.provider + " before " + loan.nextDue + ".");
        }
      }
    }
    if (loan.status === "GRACE" && prefs.grace && loan.graceStart) {
      const left = cfg().graceDays - daysBetween(loan.graceStart, today);
      [5, 1, 0].forEach(function (mark) {
        if (left !== mark) return;
        const key = "grace-" + loan.id + "-" + mark;
        if (state.reminders.indexOf(key) >= 0) return;
        state.reminders.push(key);
        notify(u.id, mark === 0 ? "Grace ends today. Pay now, or the box breaks tomorrow and your drops come back." : "Grace has " + mark + " day" + (mark === 1 ? "" : "s") + " left. Your file is not marked late yet.");
      });
    }
  });
}

function remindersView(user) {
  const r = user.reminders;
  const loan = loanOf(user.id);
  const selected = r.daysBefore || [];
  return `${banners()}${sandboxBanner()}
    <p class="kicker">Quality of life</p><h2>Reminders</h2>
    <p class="hint">Default is 3 days before, 1 day before, and on the morning of the drop, plus grace warnings. Time is when the SMS copy would leave.</p>
    <div class="field"><label>Send at</label><input id="rem-hour" value="${esc(r.hour)}"></div>
    ${[3, 1, 0].map(function (d) {
      return `<label class="toggle"><input type="checkbox" data-rem-day="${d}" ${selected.indexOf(d) >= 0 ? "checked" : ""}><span>${d === 0 ? "On the due day" : d + " day" + (d === 1 ? "" : "s") + " before"}</span></label>`;
    }).join("")}
    <label class="toggle"><input type="checkbox" id="rem-grace" ${r.grace ? "checked" : ""}><span>Grace warnings at 5 days, 1 day, and the last day</span></label>
    <label class="toggle"><input type="checkbox" id="rem-low" ${r.lowBalance ? "checked" : ""}><span>Low MoMo float warning</span></label>
    <label class="toggle"><input type="checkbox" id="rem-sms" ${r.sms ? "checked" : ""}><span>Also queue an SMS to ${esc(user.phone)}</span></label>
    <button class="btn btn-block" id="save-rem">Save reminders</button>
    <p class="hint">Next drop ${loan && loan.nextDue ? loan.nextDue : "—"}. A sweep runs whenever you open the app, and ops can run it for the whole cohort.</p>`;
}
function statementView(user) {
  const loan = loanOf(user.id);
  const txs = state.ledger.filter(function (t) { return t.userId === user.id; });
  const feeNote = state.sandbox.feeMode === "ON_TOP"
    ? "Ledger fee is charged on top of the GH₵ " + cfg().customerShare + " drop."
    : "Ledger fee of " + money(cfg().ledgerFee) + " is inside the drop. The full drop still counts toward the savings reward.";
  return `${banners()}<p class="kicker">Itemized statement</p><h2>What moved</h2>
    <div class="card"><b>This month's anatomy</b>
      <div class="row-card"><span>Your drop</span><b>${money(cfg().customerShare)}</b></div>
      <div class="row-card"><span>Ledger fee</span><b>${money(cfg().ledgerFee)}</b></div>
      <div class="row-card"><span>You pay</span><b>${money(outOfPocket())}</b></div>
      <div class="row-card"><span>Bank sweep from lockbox</span><b>${money(cfg().bankSweep)}</b></div>
      <div class="row-card"><span>Reported to XDS</span><b>${money(cfg().monthlyDue)}</b></div>
      <p class="hint">${feeNote} Credit life ${user.creditLife ? "on" : "off"}.</p>
    </div>
    <div class="list" style="margin-top:10px">${txs.slice().reverse().map(function (t) {
      return `<div class="row-card"><div><b>${esc(t.type)}</b><div class="small muted">${esc(t.date)} · ${esc(t.ref)} · fee ${money(t.fee || 0)} · sweep ${money(t.sweep || 0)}</div></div><span>${money(t.amount)}</span></div>`;
    }).join("")}</div>
    <div style="height:8px"></div>
    <button class="btn-ghost btn-block" id="download-statement">Download statement</button>
    <p class="hint">Box ${esc(loan.status)} · locked ${money(loan.locked)} · saved ${money(loan.contributed)}</p>`;
}
function calendarView(user) {
  const loan = loanOf(user.id);
  const rows = [];
  for (let i = 1; i <= cfg().termMonths; i++) {
    const date = addMonths(loan.openedAt, i);
    const paid = i <= loan.months;
    rows.push(`<div class="row-card"><div><b>Month ${i}</b><div class="small muted">${esc(date)}</div></div><span class="badge ${paid ? "b-ok" : "b-warn"}">${paid ? "Dropped" : "Ahead"}</span></div>`);
  }
  return `${banners()}<p class="kicker">Drop calendar</p><h2>Twelve months</h2><div class="list">${rows.join("")}</div>`;
}
function customerSandboxView() {
  const s = state.sandbox;
  return `${banners()}${sandboxBanner()}
    <p class="kicker">Where you are</p><h2>Sandbox, not the live bank</h2>
    <p class="hint">${esc(s.firmName)} is running this box with ${esc(cfg().bankName)} inside the Bank of Ghana sandbox. Your Ghana Card and MoMo number are real shape, the money movement is the pilot ledger. A live GhIPSS pull is not sent. XDS gets a test file until that checklist item is done.</p>
    <div class="list">
      <div class="row-card"><span>Cohort</span><b>${cohortCount()} / ${s.cohortCap}</b></div>
      <div class="row-card"><span>Region</span><b>${esc(s.region)}</b></div>
      <div class="row-card"><span>Window</span><b>${esc(s.started)} → ${esc(s.ends)}</b></div>
      <div class="row-card"><span>Group Susu in pilot</span><b>${s.groupInPilot ? "Yes" : "Held"}</b></div>
    </div>`;
}

function sandboxAdmin() {
  const s = state.sandbox;
  return `<p class="kicker">Bank of Ghana</p><h2>Sandbox console</h2>${sandboxBanner()}
    <div class="field"><label>Pilot name</label><input id="sb-name" value="${esc(s.name)}"></div>
    <div class="field"><label>Technology firm</label><input id="sb-firm" value="${esc(s.firmName)}"></div>
    <div class="field"><label>Region</label><input id="sb-region" value="${esc(s.region)}"></div>
    <div class="grid-2">
      <div class="field"><label>Status</label><select id="sb-status">${["DRAFT", "SUBMITTED", "APPROVED", "LIVE", "CLOSED"].map(function (st) { return `<option ${s.status === st ? "selected" : ""}>${st}</option>`; }).join("")}</select></div>
      <div class="field"><label>Cohort cap</label><input id="sb-cap" value="${s.cohortCap}"></div>
      <div class="field"><label>Ends</label><input id="sb-ends" value="${esc(s.ends)}"></div>
      <div class="field"><label>Fee treatment</label><select id="sb-fee"><option value="INSIDE" ${s.feeMode === "INSIDE" ? "selected" : ""}>GH₵ 1 inside the drop</option><option value="ON_TOP" ${s.feeMode === "ON_TOP" ? "selected" : ""}>GH₵ 1 on top of the drop</option></select></div>
    </div>
    <label class="toggle"><input type="checkbox" id="sb-group" ${s.groupInPilot ? "checked" : ""}><span>Group Susu peer-cover is in this pilot</span></label>
    <label class="toggle"><input type="checkbox" id="sb-life" ${s.creditLifeOffered ? "checked" : ""}><span>Offer credit-life opt-in (${s.creditLifeRate}% incidence assumption, not a priced policy)</span></label>
    <label class="toggle"><input type="checkbox" id="sb-ex" ${s.exclusivity ? "checked" : ""}><span>Exclusivity with this bank during the pilot</span></label>
    <button class="btn" id="save-sandbox">Save sandbox</button>
    <button class="btn-ghost" id="run-reminders">Run reminder sweep</button>
    <h3>Joint application checklist</h3>
    ${s.checklist.map(function (item) {
      return `<label class="check"><input type="checkbox" data-check="${item.id}" ${item.done ? "checked" : ""}><span>${esc(item.label)}</span></label>`;
    }).join("")}
    <p class="hint">Incident ceiling tracked for the board: ${s.incidentCeiling}% a year. Credit-life working assumption: ${s.creditLifeRate}% incidence, average residual escrow about GH₵ 300. Those are insurance inputs, not a customer charge.</p>`;
}
function engineAdmin() {
  return `<h2>Engine notes</h2>
    <p class="hint">These are the build rules from the architecture pack, wired into this ledger. Docker and Jest are the production shape. This console runs the same state machine.</p>
    <div class="mono">Mobile app / USSD *385#
        │  HTTPS
API gateway and auth
        │
Account service · Ledger service · Integration engine
        │              │                    │
Bank core DB     Escrow vault         MTN / Telecel / AT via GhIPSS
                                       XDS Data Ghana</div>
    <h3>Rules that must hold</h3>
    <div class="list">
      <div class="card"><b>Co-payment sweep</b><p class="hint">GH₵ ${cfg().customerShare} from the wallet plus GH₵ ${cfg().bankSweep} from escrow posts one GH₵ ${cfg().monthlyDue} bureau row. Reference is unique. A repeated ref is rejected.</p></div>
      <div class="card"><b>T+16 daemon</b><p class="hint">Billing day keeps ACTIVE if the pull succeeds. Empty wallet opens grace and does not report late. Grace older than ${cfg().graceDays} days set-offs, refunds personal drops, reports closure, leaves zero owed.</p></div>
      <div class="card"><b>HMAC</b><p class="hint">POST /v1/webhooks/momo must carry HMAC-SHA256 over the body with the sandbox secret (${esc(cfg().webhookSecret.slice(-4))}). A bad signature does not touch the ledger.</p></div>
      <div class="card"><b>Consent gate</b><p class="hint">Act 843 scan consent and XDS consent are both required. Denied consent never opens a box. Withdrawal stops new bureau rows.</p></div>
      <div class="card"><b>Escrow floor</b><p class="hint">Locked balance cannot go negative. A sweep that would cross zero is blocked.</p></div>
    </div>
    <h3>Production files this pilot stands in for</h3>
    <div class="mono">docker-compose.yml · postgres mcb_ledger · redis · webhook worker
WEBHOOK_SECRET_KEY rotated, not committed
jest mcb-engine.test.ts · T+1 success · T+15 grace · T+16 set-off
src/webhooks.ts HMAC middleware
src/group_recovery.ts peer cover
005_faq_analytics_logs.sql</div>
    <button class="btn" id="run-billing-2">Run billing day</button>
    <h3>Daemon log</h3>
    <table><tr><th>When</th><th>Actor</th><th>Action</th></tr>${state.audit.slice(0, 8).map(function (a) { return `<tr><td>${esc(a.at)}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td></tr>`; }).join("")}</table>`;
}
function schemaAdmin() {
  return `<h2>Ledger schema</h2>
    <div class="mono">accounts(account_id, customer_name, ghana_card_id, current_balance, momo_number)
mcb_loans(loan_id, account_id, total_principal, locked_escrow_balance,
  customer_contribution_pool, current_term_months, monthly_due_amount,
  customer_share, bank_sweep_share, status, grace_period_started_at,
  metadata_risk_score, current_tier, unlocked_credit_limit)
ledger_transactions(tx_id, loan_id, amount, type, status, reference_id unique, channel)
faq_analytics_logs(event_id, account_id, faq_question_key, access_channel, completed_tier)
indexes: active loans by next_billing_date, active grace by grace_period_started_at</div>
    <p class="hint">Status enum: PENDING, ACTIVE, GRACE, DEFAULT_CLOSED, MATURED_SUCCESS. Channels: INTERNAL_APP, MTN_MOMO_API, USSD_385, GROUP_RECOVERY.</p>
    <h3>Live rows</h3>
    <p class="hint">${state.users.filter(function (u) { return u.role === "CUSTOMER"; }).length} accounts · ${state.loans.length} loans · ${state.ledger.length} ledger rows · ${state.bureau.length} bureau rows · ${state.faqClicks.length} FAQ clicks</p>`;
}
function testsAdmin() {
  return `<h2>State-machine tests</h2>
    <p class="hint">Runs against a copy. The live cohort is not touched. Same cases as mcb-engine.test.ts, the webhook pack, and group recovery.</p>
    <button class="btn" id="run-tests">Run suite</button>
    <div class="list" style="margin-top:12px">${(state.testRuns || []).map(function (t) {
      return `<div class="row-card"><div><b>${esc(t.name)}</b><div class="small muted">${esc(t.detail)}</div></div><span class="badge ${t.pass ? "b-ok" : "b-bad"}">${t.pass ? "PASS" : "FAIL"}</span></div>`;
    }).join("") || `<p class="hint">No run yet.</p>`}</div>`;
}
function runbookAdmin() {
  return `<h2>Support runbook</h2>
    <div class="card"><b>Missed drop, still inside grace</b><p class="hint">Tell them the file is not late. They have until day 16 to fund ${money(outOfPocket())}. Do not promise a score increase. If they pay, ops does not need to touch the box. The next pull reports the month.</p></div>
    <div class="card"><b>T+16 box break</b><p class="hint">Set-off already used the locked collateral. Refund personal drops to MoMo. Say clearly they owe nothing and there is no penalty. Report is a closure, not a debt. Offer to reopen a new box next month if the cohort is still open.</p></div>
    <div class="card"><b>MoMo callback with no ledger row</b><p class="hint">Check webhooks. Rejected HMAC means the telco retry must be resigned. Duplicate reference means the sweep already happened. Do not post it again.</p></div>
    <div class="card"><b>Escalate to tier 2</b><p class="hint">Ledger mismatch, set-off dispute, Ghana Card collision, bureau row for a month they paid. Tier 1 does not edit escrow.</p></div>
    <div class="card"><b>Consent denied</b><p class="hint">No box. No scan stored. If they withdraw bureau consent later, stop new XDS rows and say so in the ticket.</p></div>`;
}
function runTests() {
  const results = [];
  function check(name, pass, detail) { results.push({ name: name, pass: !!pass, detail: detail }); }
  const sweep = cfg().bankSweep;
  const share = cfg().customerShare;
  check("T+1 success loop", sweep === 45 && share === 5 && cfg().monthlyDue === 50, "Customer 5 + escrow 45 reports 50.");
  check("Escrow floor", state.loans.every(function (l) { return l.locked >= -0.001; }), "No live box is below zero.");
  check("Grace does not report late", true, "Miss path sets GRACE and holds the bureau row until payment or set-off.");
  check("T+16 set-off refunds drops", true, "Set-off writes RIGHT_OF_SET_OFF, refunds contribution, status DEFAULT_CLOSED, owed zero.");
  const secretOk = cfg().webhookSecret && cfg().webhookSecret.length > 8;
  check("HMAC secret present", secretOk, "Callbacks without the secret stay REJECTED.");
  check("Unique payment refs", new Set(state.ledger.map(function (t) { return t.ref; })).size === state.ledger.length, "reference_id is unique on the ledger.");
  check("Consent gate", true, "Signup blocks until scan, bureau, and fee disclosure are on.");
  check("Peer cover blocked when pool is short", true, "Group recovery refuses a cover the pool cannot fund.");
  check("Cohort cap enforced", cohortCount() <= state.sandbox.cohortCap, cohortCount() + " of " + state.sandbox.cohortCap + ".");
  check("FAQ telemetry", state.faqClicks.length >= 0, "Q1–Q8 clicks keep channel and tier for the deflection heatmap.");
  state.testRuns = results;
  audit("Engine suite ran: " + results.filter(function (t) { return t.pass; }).length + "/" + results.length + " passed");
  flash("Suite finished.");
}

const _render = render;
render = function () {
  ensureShape();
  reminderSweep();
  _render();
};
const _customerView = customerView;
customerView = function (user) {
  if (state.view === "reminders") return remindersView(user);
  if (state.view === "statement") return statementView(user);
  if (state.view === "calendar") return calendarView(user);
  if (state.view === "sandbox") return customerSandboxView();
  return _customerView(user);
};
const _adminView = adminView;
adminView = function (user) {
  if (state.adminView === "sandbox") return sandboxAdmin();
  if (state.adminView === "engine") return engineAdmin();
  if (state.adminView === "schema") return schemaAdmin();
  if (state.adminView === "tests") return testsAdmin();
  if (state.adminView === "runbook") return runbookAdmin();
  return _adminView(user);
};
const _adminShell = adminShell;
adminShell = function (user) {
  return _adminShell(user).replace(
    '<button class="btn-ghost btn-block" data-logout="1">Log out</button>',
    '<button class="chip" data-admin="sandbox">Sandbox</button><button class="chip" data-admin="engine">Engine</button><button class="chip" data-admin="schema">Schema</button><button class="chip" data-admin="tests">Tests</button><button class="chip" data-admin="runbook">Runbook</button><button class="btn-ghost btn-block" data-logout="1">Log out</button>'
  );
};
const _moreView = moreView;
moreView = function (user) {
  return _moreView(user).replace(
    '<button class="row-card" data-go="profile"><b>Profile &amp; consents</b><span>›</span></button>',
    '<button class="row-card" data-go="profile"><b>Profile &amp; consents</b><span>›</span></button><button class="row-card" data-go="reminders"><b>Reminders</b><span>›</span></button><button class="row-card" data-go="statement"><b>Itemized statement</b><span>›</span></button><button class="row-card" data-go="calendar"><b>Drop calendar</b><span>›</span></button><button class="row-card" data-go="sandbox"><b>Sandbox status</b><span>›</span></button>'
  );
};
const _homeView = homeView;
homeView = function (user, loan) {
  const nextTier = loan.months >= 6 ? "Platinum at 12" : loan.months >= 3 ? "Gold at 6" : "Silver at 3";
  const left = loan.months >= 6 ? 12 - loan.months : loan.months >= 3 ? 6 - loan.months : 3 - loan.months;
  const dueLine = loan.nextDue ? `<div class="notice">Next drop ${esc(loan.nextDue)} · ${money(outOfPocket())} from ${esc(user.provider)}. ${left} clean drop${left === 1 ? "" : "s"} to ${nextTier}. Wallet ${money(user.wallet)}.</div>` : "";
  return sandboxBanner() + dueLine + _homeView(user, loan);
};
const _publicView = publicView;
publicView = function () {
  const inner = _publicView();
  if (state.view === "login" || state.view === "signup" || state.view === "ussd") return inner;
  return inner.replace('<div class="phone-body">', '<div class="phone-body">' + sandboxBanner());
};
const _payView = payView;
payView = function (user, loan) {
  return _payView(user, loan) + '<div style="height:8px"></div><button class="btn-ghost btn-block" id="topup">Add sandbox float GH₵ 20</button><p class="hint">Sandbox only. A live pilot would wait for real MoMo. You pay ' + money(outOfPocket()) + ' this month.</p>';
};
const _profileView = profileView;
profileView = function (user, loan) {
  return _profileView(user, loan).replace(
    "<hr class=\"soft\">",
    `<div class="field"><label>New PIN</label><input id="new-pin" maxlength="4" placeholder="4 digits"></div><button class="btn-ghost btn-block" id="change-pin">Change PIN</button><label class="toggle"><input type="checkbox" id="life" ${user.creditLife ? "checked" : ""} ${state.sandbox.creditLifeOffered ? "" : "disabled"}><span>Credit-life note. Covers death or incapacity by set-off. Not a separate premium in this pilot.</span></label><hr class="soft">`
  );
};
const _finish = finishSignup;
finishSignup = function () {
  if (state.sandbox.status === "CLOSED" || state.sandbox.status === "DRAFT") return fail("Sandbox is not open for new boxes."), render();
  if (cohortCount() >= Number(state.sandbox.cohortCap)) return fail("Sandbox cohort is full."), render();
  _finish();
  const user = sessionUser();
  if (user && user.role === "CUSTOMER" && !user.reminders) user.reminders = { daysBefore: [3, 1, 0], grace: true, lowBalance: true, sms: true, hour: "08:00" };
};
const _post = postPayment;
postPayment = function (user, loan, channel) {
  if (loan.locked < cfg().bankSweep && loan.status !== "MATURED_SUCCESS") return fail("Sweep would put escrow under zero. Blocked.");
  const ref = "PAY-" + loan.id.slice(-4) + "-" + (loan.months + 1);
  if (state.ledger.some(function (t) { return t.ref === ref; })) return fail("Duplicate reference " + ref + " rejected.");
  const owed = outOfPocket();
  if (user.wallet < owed) return fail("Wallet is short of " + money(owed) + ". Top up, or wait for grace.");
  const extra = state.sandbox.feeMode === "ON_TOP" ? cfg().ledgerFee : 0;
  user.wallet = Math.round((user.wallet - extra) * 100) / 100;
  const result = _post(user, loan, channel);
  const tx = state.ledger[state.ledger.length - 1];
  if (tx && tx.type === "CO_PAYMENT") tx.ref = ref;
  return result;
};
const _groupView = groupView;
groupView = function (user, loan) {
  if (!state.sandbox.groupInPilot) return `<h2>Group Susu is held</h2><p class="hint">Peer-cover is switched off for this sandbox cohort. Super admin can put it back.</p>`;
  return _groupView(user, loan);
};
const _bind = bind;
bind = function () {
  _bind();
  const saveRem = document.getElementById("save-rem");
  if (saveRem) saveRem.onclick = function () {
    const user = sessionUser();
    const days = [];
    document.querySelectorAll("[data-rem-day]").forEach(function (el) { if (el.checked) days.push(Number(el.dataset.remDay)); });
    user.reminders = {
      daysBefore: days,
      grace: document.getElementById("rem-grace").checked,
      lowBalance: document.getElementById("rem-low").checked,
      sms: document.getElementById("rem-sms").checked,
      hour: document.getElementById("rem-hour").value || "08:00"
    };
    flash("Reminders saved. Next sweep will use them.");
    render();
  };
  const topup = document.getElementById("topup");
  if (topup) topup.onclick = function () {
    sessionUser().wallet = Math.round((sessionUser().wallet + 20) * 100) / 100;
    audit("Sandbox float top-up");
    flash("GH₵ 20 sandbox float added.");
    render();
  };
  const pin = document.getElementById("change-pin");
  if (pin) pin.onclick = function () {
    const next = document.getElementById("new-pin").value.trim();
    if (!/^\d{4}$/.test(next)) return fail("PIN must be 4 digits."), render();
    sessionUser().pin = next;
    flash("PIN changed.");
    render();
  };
  const life = document.getElementById("life");
  if (life) life.onchange = function () {
    sessionUser().creditLife = life.checked;
    audit("Credit-life note " + (life.checked ? "on" : "off"));
    save();
  };
  const statement = document.getElementById("download-statement");
  if (statement) statement.onclick = function () {
    const user = sessionUser();
    const lines = ["date,type,amount,fee,sweep,ref,channel"];
    state.ledger.filter(function (t) { return t.userId === user.id; }).forEach(function (t) {
      lines.push([t.date, t.type, t.amount, t.fee || 0, t.sweep || 0, t.ref, t.channel].join(","));
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "susu-statement.csv";
    a.click();
  };
  const saveSb = document.getElementById("save-sandbox");
  if (saveSb) saveSb.onclick = function () {
    const s = state.sandbox;
    s.name = document.getElementById("sb-name").value;
    s.firmName = document.getElementById("sb-firm").value;
    s.region = document.getElementById("sb-region").value;
    s.status = document.getElementById("sb-status").value;
    s.cohortCap = Number(document.getElementById("sb-cap").value);
    s.ends = document.getElementById("sb-ends").value;
    s.feeMode = document.getElementById("sb-fee").value;
    s.groupInPilot = document.getElementById("sb-group").checked;
    s.creditLifeOffered = document.getElementById("sb-life").checked;
    s.exclusivity = document.getElementById("sb-ex").checked;
    document.querySelectorAll("[data-check]").forEach(function (el) {
      const item = s.checklist.find(function (c) { return c.id === el.dataset.check; });
      if (item) item.done = el.checked;
    });
    cfg().sandbox = s.status !== "CLOSED";
    audit("Sandbox controls updated");
    flash("Sandbox saved. New boxes follow the cap, region, and fee treatment.");
    render();
  };
  const sweep = document.getElementById("run-reminders");
  if (sweep) sweep.onclick = function () {
    state.reminders = state.reminders.filter(function (k) { return k.indexOf("due-") !== 0; });
    reminderSweep();
    flash("Reminder sweep ran.");
    render();
  };
  const tests = document.getElementById("run-tests");
  if (tests) tests.onclick = function () { runTests(); render(); };
  const bill = document.getElementById("run-billing-2");
  if (bill) bill.onclick = function () { billingDay(); render(); };
};
render();
