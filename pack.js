function keyFactsHtml() {
  const bank = cfg().bankName;
  return `<div class="list">
    <div class="row-card"><span>What you open</span><b>A locked savings box</b></div>
    <div class="row-card"><span>Cash up front</span><b>You choose the amount</b></div>
    <div class="row-card"><span>Term</span><b>12 months</b></div>
    <div class="row-card"><span>Activation</span><b>${money(cfg().setupFee)} once</b></div>
    <div class="row-card"><span>Interest in this app</span><b>None shown</b></div>
    <div class="row-card"><span>Bureau</span><b>${esc(bank)} files it</b></div>
  </div>
  <p class="hint">The amount is pushed to ${esc(bank)} and stays there. Each month is marked from that savings. You do not add a new charge. If a wallet pull fails, the app retries for 72 hours before grace starts. Grace lasts ${cfg().graceDays} days. After that the box closes, what is still yours comes back, and you do not owe a balance.</p>
  <p class="hint"><b>Good.</b> Easier than a normal loan. A clean history. Your savings come back at month 12.</p>
  <p class="hint"><b>Not good.</b> You cannot spend the savings while the 12 months run. The activation fee is not refunded. A missed month, if it is not cured, is closed on the file. It is not left as a debt.</p>
  <p class="hint">Complaints: this help desk, then ${esc(bank)}, then the Bank of Ghana. The file is a secured savings record, not an open loan.</p>`;
}
function ensurePack() {
  if (!FAQ.some(function (q) { return q[0] === "Q9"; })) {
    FAQ.push(["Q9", "What if MoMo is down on the day?", "The pull retries for 72 hours before grace starts. A network delay is not a missed month. If the screen is behind your SMS, the desk can refresh the month. It will not take the money twice."]);
    FAQ.push(["Q10", "Who do I complain to?", "First this help desk. Then the partner bank. Then the Bank of Ghana. Ask for the key facts if a fee was not clear before you opened the box."]);
    FAQ.push(["Q11", "Can I take the savings out early?", "Not while the box is open. Break box early on your profile closes it the same way a missed month does. Your remaining savings come back. The record closes. It does not become a debt."]);
  }
  state.loans.forEach(function (l) { if (l.pullWindow == null) l.pullWindow = false; });
}

function factsView() {
  return `${banners()}<p class="kicker">Bank of Ghana</p><h2>Key facts</h2>${keyFactsHtml()}`;
}
function runbookHtml() {
  const pick = state.deskScript || "missed";
  const scripts = {
    missed: "You are safe. This is not a debt trap and nobody is coming to the shop. The savings at the bank is the collateral. If the wallet pull failed, we retry for 72 hours, then open a 15-day grace. Your name is not marked late yet. Turn autopay on, or tap Pay, before day 16.",
    closed: "The grace ended, so the box was closed with the locked savings. You do not owe the bank a pesewa. What was still yours is back in the wallet. Check that balance. You can open a fresh box when the market is steady.",
    lag: "Your money is safe. The phone SMS can arrive before this screen moves. I am matching the reference. If it landed, I will refresh the month. We will not take it a second time."
  };
  return `<div class="card"><b>Desk scripts</b>
    <p class="hint">ACTIVE_GRACE is the safe window. DEFAULT_CLOSED means the box was settled and the remainder returned. PENDING_WEBHOOK means the telco moved and our screen has not.</p>
    <div class="field"><label>Script</label><select id="desk-script">
      <option value="missed" ${pick === "missed" ? "selected" : ""}>Missed month fear</option>
      <option value="closed" ${pick === "closed" ? "selected" : ""}>Box closed</option>
      <option value="lag" ${pick === "lag" ? "selected" : ""}>SMS arrived, ring did not move</option>
    </select></div>
    <p class="hint" id="script-text">${esc(scripts[pick] || scripts.missed)}</p>
  </div>`;
}
function scorecardAdmin() {
  const loans = state.loans;
  const builder = loans.filter(function (l) { return l.savings || l.principal; });
  const n = builder.length || 1;
  const m3 = builder.filter(function (l) { return l.months >= 3 || l.status === "MATURED_SUCCESS"; }).length;
  const m6 = builder.filter(function (l) { return l.months >= 6 || l.status === "MATURED_SUCCESS"; }).length;
  const m12 = builder.filter(function (l) { return l.status === "MATURED_SUCCESS"; }).length;
  const grace = loans.filter(function (l) { return l.status === "GRACE"; }).length;
  const closed = loans.filter(function (l) { return l.status === "DEFAULT_CLOSED"; }).length;
  const badClose = loans.filter(function (l) { return l.status === "DEFAULT_CLOSED" && Number(l.locked) > 0; }).length;
  const wh = state.webhooks || [];
  const okWh = wh.filter(function (w) { return w.verified && w.status === "APPLIED"; }).length;
  const pullRate = wh.length ? Math.round((okWh / wh.length) * 1000) / 10 : null;
  const float = loans.filter(function (l) { return l.status === "ACTIVE" || l.status === "GRACE"; }).reduce(function (s, l) { return s + Number(l.locked || 0); }, 0);
  const leak = loans.filter(function (l) { return Number(l.locked) < 0; }).length;
  function gate(ok, name, detail) {
    return `<div class="row-card"><div><b>${esc(name)}</b><div class="small muted">${esc(detail)}</div></div><span class="badge ${ok ? "b-ok" : "b-warn"}">${ok ? "Pass" : "Hold"}</span></div>`;
  }
  return `<h2>Pilot scorecard</h2>
    <p class="hint">These are the gates between the sandbox book and a wider rollout. The bureau file is still the bank's.</p>
    <div class="kpi-grid">
      <div class="stat"><span>Boxes</span><b>${builder.length}</b></div>
      <div class="stat"><span>Locked at the bank</span><b>${money(float)}</b></div>
      <div class="stat"><span>In grace</span><b>${grace}</b></div>
      <div class="stat"><span>Closed clean</span><b>${closed}</b></div>
    </div>
    <div class="list" style="margin-top:12px">
      ${gate(pullRate == null || pullRate >= 99.7, "Webhook pull success", pullRate == null ? "No callbacks yet. Gate is 99.7%." : pullRate + "% verified and applied")}
      ${gate(badClose === 0, "Set-off accuracy", badClose === 0 ? "Every closed box is at zero." : badClose + " still show a lock")}
      ${gate(leak === 0, "No savings leakage", leak + " boxes under zero")}
      ${gate(cohortCount() <= state.sandbox.cohortCap, "Cohort cap", cohortCount() + " of " + state.sandbox.cohortCap)}
    </div>
    <h3>Where the book is</h3>
    <div class="list">
      <div class="row-card"><span>Reached month 3</span><b>${Math.round(m3 / n * 100)}%</b></div>
      <div class="row-card"><span>Reached month 6</span><b>${Math.round(m6 / n * 100)}%</b></div>
      <div class="row-card"><span>Finished 12</span><b>${Math.round(m12 / n * 100)}%</b></div>
      <div class="row-card"><span>Grace against closed</span><b>${grace} open, ${closed} closed</b></div>
    </div>`;
}
function packAdmin() {
  return `<h2>Partnership pack</h2>
    <p class="hint">Pitch, letter of intent, revenue split, and scripts live in strategy.md. This screen is the part you use in the room. The illustrated GH₵ 600 case is the bank story. In the app the customer chooses the amount.</p>
    <div class="card"><b>Who we partner with</b><p class="hint">A licensed bank or savings and loans, not a direct Bank of Ghana license, and not a competing lender. They hold the savings. We keep the app.</p></div>
    <div class="card"><b>Opening line</b><p class="hint">We manufacture customers the bank can trust. They hold the savings. We run the app, the market, and the support. If someone stops, the box closes and nobody is left owing.</p></div>
    <table><tr><th>Stream</th><th>Bank</th><th>Us</th></tr>
      <tr><td>Treasury yield on locked savings</td><td>60%</td><td>40%</td></tr>
      <tr><td>Activation fee</td><td>20%</td><td>80%</td></tr>
      <tr><td>Any monthly admin fee</td><td>30%</td><td>70%</td></tr>
      <tr><td>Later loan the bank funds</td><td>70%</td><td>30% introduction</td></tr>
    </table>
    <p class="hint">Treasury bills stay off unless super admin turns that switch on. We are not registered with the Securities and Exchange Commission.</p>
    <h3>After a yes</h3>
    <div class="list">
      <div class="row-card"><span>Technology</span><b>Sandbox pulls, ledger, USSD</b></div>
      <div class="row-card"><span>Risk</span><b>Grace, set-off, no debt tag</b></div>
      <div class="row-card"><span>Market</span><b>Makola and Kejetia, *385#</b></div>
    </div>
    <h3>Flyer line</h3>
    <p class="hint">Do susu for a year and build your credit. Choose what you save. The bank keeps it safe. Twelve months later it comes back, and the bank has the record.</p>`;
}

const _signupP = signupView;
signupView = function () {
  const html = _signupP();
  if ((state.signup.step || 1) !== 2) return html;
  const block = `<details class="faq"><summary><b>Key facts</b> Read this before you agree</summary>${keyFactsHtml()}</details>
    <label class="toggle"><input type="checkbox" id="c-facts" ${state.signup.facts ? "checked" : ""}><span>I have read the key facts. I know the savings stay locked, and I know how a missed month closes.</span></label>`;
  return html.replace('<button class="btn btn-block" id="su-scan">', block + '<button class="btn btn-block" id="su-scan">');
};
const _moreP = moreView;
moreView = function (user) {
  const html = _moreP(user);
  const at = html.indexOf('data-go="ussd"');
  if (at < 0) return html;
  const end = html.indexOf("</button>", at);
  return html.slice(0, end + 9) + '<button class="row-card" data-go="facts"><b>Key facts</b><span>›</span></button>' + html.slice(end + 9);
};
const _helpP = helpView;
helpView = function (user) {
  return _helpP(user).replace(
    "<h2>Talk to a person</h2>",
    "<h2>Talk to a person</h2><p class=\"hint\">1. This desk. 2. " + esc(cfg().bankName) + " complaints. 3. Bank of Ghana, if it is still not settled. Read the key facts before you write.</p><button class=\"btn-ghost btn-block\" data-go=\"facts\">Key facts</button>"
  );
};
const _custP = customerView;
customerView = function (user) {
  if (state.view === "facts") return factsView();
  return _custP(user);
};
const _deskP = deskAdmin;
deskAdmin = function (actor) {
  return runbookHtml() + _deskP(actor).replace(
    /<button class="btn" data-reply="([^"]+)">Reply<\/button>/g,
    '<button class="chip" data-fill="$1">Use script</button> <button class="btn" data-reply="$1">Reply</button>'
  );
};
const _adminP = adminView;
adminView = function (user) {
  if (state.adminView === "score") return scorecardAdmin();
  if (state.adminView === "pack") return user.role === "SUPER" || user.role === "OPS" ? packAdmin() : `<h2>Not your desk</h2>`;
  return _adminP(user);
};
const _shellP = adminShell;
adminShell = function (user) {
  return _shellP(user).replace(
    'data-admin="forget">Forget-me</button>',
    'data-admin="forget">Forget-me</button><button class="chip" data-admin="score">Scorecard</button><button class="chip" data-admin="pack">Pack</button>'
  );
};

const _payP = postPayment;
postPayment = function (user, loan, channel) {
  const result = _payP(user, loan, channel);
  if (loan) { loan.pullWindow = false; loan.retryUntil = null; }
  return result;
};
const _billP = billingDay;
billingDay = function () {
  state.loans.forEach(function (loan) {
    if (loan.autopay || loan.status !== "ACTIVE") return;
    if (!loan.nextDue || loan.nextDue > todayISO(0)) return;
    if (loan.pullWindow) return;
    loan.pullWindow = true;
    loan.retryUntil = todayISO(3);
    loan.nextDue = loan.retryUntil;
    const user = state.users.find(function (u) { return u.id === loan.userId; });
    if (user) {
      notify(user.id, "The month did not mark. We retry for 72 hours before grace.");
      sendMail(user, "RETRY", "72-hour retry", "Autopay is off or the pull missed. Grace does not start until " + loan.retryUntil + ".");
    }
  });
  _billP();
};

const _bindP = bind;
bind = function () {
  _bindP();
  const scan = document.getElementById("su-scan");
  if (scan) scan.onclick = function () {
    state.signup.scan = document.getElementById("c-scan").checked;
    state.signup.terms = document.getElementById("c-terms").checked;
    state.signup.facts = document.getElementById("c-facts").checked;
    if (!state.signup.scan || !state.signup.terms || !state.signup.facts) return fail("Read the key facts, then accept both permissions."), render();
    state.signup.scanning = true;
    render();
    setTimeout(function () {
      const raw = 58 + Math.floor(Math.random() * 30);
      state.signup.score = raw;
      state.signup.score850 = Math.round(300 + raw * 5.5);
      state.signup.scanning = false;
      state.signup.step = 3;
      state.signup.bureau = true;
      render();
    }, 700);
  };
  const script = document.getElementById("desk-script");
  if (script) script.onchange = function () { state.deskScript = script.value; render(); };
  document.querySelectorAll("[data-fill]").forEach(function (el) {
    el.onclick = function () {
      const input = document.querySelector('[data-reply-for="' + el.dataset.fill + '"]');
      const text = document.getElementById("script-text");
      if (input && text) input.value = text.textContent;
    };
  });
};

const _renderP = render;
render = function () {
  ensurePack();
  _renderP();
};
render();
