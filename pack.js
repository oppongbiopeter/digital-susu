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
  if (!state.packTasks) state.packTasks = { tech: false, risk: false, market: false, compliance: false };
  if (!state.funnel) state.funnel = { started: 0, finished: 0 };
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
      <div class="row-card"><span>Signup finished</span><b>${state.funnel && state.funnel.started ? Math.round(state.funnel.finished / state.funnel.started * 100) + "% of " + state.funnel.started : "No new signup yet"}</b></div>
    </div>`;
}
function packTasks() {
  return [
    ["tech", "Technology", "Sandbox pulls, the month marker, USSD, and a webhook that refuses a duplicate."],
    ["risk", "Risk", "72-hour retry, 15-day grace, then a close. A closed box is not tagged as a bad debt."],
    ["market", "Market", "Makola and Kejetia first, then the flyer and " + cfg().ussdCode + "."],
    ["compliance", "Compliance", "Key facts before signup, separate consent, and no chats or photos."]
  ];
}
function loiText() {
  const bank = cfg().bankName;
  const firm = (state.sandbox && state.sandbox.firmName) || "Digital Susu";
  return firm + "\n\nTo the Head of Retail, " + bank + ".\n\nWe propose a custody partnership for Digital Susu. The customer chooses a savings amount. It is pushed to " + bank + " and twelve months are marked from it. " + bank + " files the credit record. We run the app, USSD " + cfg().ussdCode + ", the market agents, and first-line support. " + bank + " holds the money, the ledger on its core, and the licence.\n\nA first pilot is capped, region-locked, and filed together under the Bank of Ghana sandbox. The savings stay locked. If a customer stops, the box closes and they do not owe a balance.\n\nWe license the software. " + bank + " does not own the code, the score, or the market list.\n\nThis letter is not a contract.\n\n" + firm;
}
function flyerText() {
  return "DO SUSU FOR A YEAR AND BUILD YOUR CREDIT\n\nChoose what you save. " + cfg().bankName + " keeps it. Twelve months later it comes back, and the bank has the record.\n\nYou need a Ghana Card and a mobile money wallet.\nActivation is " + money(cfg().setupFee) + ", once. There is no second bill in this app.\n\nIf the market is slow, nobody comes to the shop. The box closes and you do not owe a pesewa.\n\nDial " + cfg().ussdCode + " or ask an agent at the market.";
}
function townHallText() {
  return "Ameeeooo.\n\nThe banks ask for a payslip you do not have. This one does not. You choose what to save. It stays at " + cfg().bankName + ".\n\nIf the market is slow and you stop, nobody comes to the shop, and you do not owe a pesewa. If you finish the year, the savings come back.\n\nDial " + cfg().ussdCode + ", or see the agent on this floor.";
}
function radioText() {
  return "Sister, the rain stopped the market. The old lender will come for the stock. This one is different.\n\nDial " + cfg().ussdCode + ". You choose what to save. The bank locks it. If you cannot continue, the box closes and you owe nothing. If you finish the year, the savings come back.";
}
function marketKit() {
  return `<div class="card flyer"><b>DO SUSU FOR A YEAR</b><p>${esc(flyerText()).replace(/\n/g, "<br>")}</p></div>
    <details class="faq"><summary><b>Town hall</b> Say this in the market</summary><p class="hint">${esc(townHallText())}</p></details>
    <details class="faq"><summary><b>Radio</b> 60 seconds</summary><p class="hint">${esc(radioText())}</p></details>
    <div class="card"><b>Do not say this on the floor</b><p class="hint">Do not promise a profit. Do not say they are buying a treasury bill. Do not say the amount is fixed. Do not say we file the credit bureau. The bank does that.</p></div>`;
}
function limitsHtml() {
  const rows = [
    ["We file the credit bureau ourselves", false, "The bank files it. We only produce the report."],
    ["The savings amount is fixed", false, "The customer chooses it. GH₵ 600 is only the illustrated bank story."],
    ["There is a second monthly fee", false, "This app charges the activation fee only, unless a super admin changes the product."],
    ["A return is guaranteed", !!(state.sec && state.sec.guaranteedReturnCopy), "Switch: guaranteed return copy."],
    ["The box earns a yield", !!(state.sec && state.sec.customerYieldLanguage), "Switch: customer yield language."],
    ["Customers can buy treasury bills here", !!(state.sec && state.sec.tbillCustomerOffer), "Switch: treasury bills for customers."]
  ];
  return `<div class="list">${rows.map(function (row) {
    const on = row[1];
    return `<div class="row-card"><div><b>${esc(row[0])}</b><div class="small muted">${esc(row[2])}</div></div><span class="badge ${on ? "b-bad" : "b-ok"}">${on ? "Switch on" : "Off"}</span></div>`;
  }).join("")}</div>
  <p class="hint">Off is the correct state until a securities registration is marked in force. The switches themselves sit under SEC switches.</p>`;
}
function packAdmin() {
  const tab = state.packTab || "room";
  const tabs = [["room", "Room"], ["letter", "Letter"], ["split", "Split"], ["flyer", "Flyer"], ["market", "Market"], ["limits", "Limits"]];
  let body = "";
  if (tab === "room") {
    body = `<div class="card"><b>Who we partner with</b><p class="hint">A licensed bank or savings and loans. Not a licence of our own from the Bank of Ghana. Not a lender that already sells a credit builder. They hold the savings. We keep the app.</p></div>
      <div class="card"><b>Opening line</b><p class="hint">We manufacture customers the bank can trust. They hold the savings. We run the app, the market, and the support. If someone stops, the box closes and nobody is left owing.</p></div>
      <h3>After a yes</h3>
      ${packTasks().map(function (task) {
        const done = state.packTasks && state.packTasks[task[0]];
        return `<label class="check"><input type="checkbox" data-pack-task="${task[0]}" ${done ? "checked" : ""}><span><b>${esc(task[1])}</b> ${esc(task[2])}</span></label>`;
      }).join("")}`;
  }
  if (tab === "letter") {
    body = `<p class="hint">Template only. It is not signed. The bank name comes from product controls.</p>
      <pre class="mono">${esc(loiText())}</pre>
      <button class="btn" id="copy-loi">Copy letter</button>
      <button class="btn-ghost" id="download-loi">Download letter</button>
      <h3>What we keep</h3>
      <p class="hint">The bank gets a licence to use the service in Ghana. It does not get the code, the score, or the right to hand the app to someone else. A mutual non-disclosure comes before any schema is shared. Ghana law. Three years.</p>`;
  }
  if (tab === "split") {
    body = `<p class="hint">Negotiation numbers for the room, not a signed split. Treasury-bill activity stays off in the product.</p>
      <table><tr><th>Stream</th><th>Bank</th><th>Us</th><th>Why</th></tr>
        <tr><td>Yield on locked savings</td><td>60%</td><td>40%</td><td>They hold the licence and the money.</td></tr>
        <tr><td>Activation fee</td><td>20%</td><td>80%</td><td>We pay the market and the scan.</td></tr>
        <tr><td>Monthly admin fee, if any</td><td>30%</td><td>70%</td><td>We run the app. They clear the wallet pull.</td></tr>
        <tr><td>A later loan they fund</td><td>70%</td><td>30%</td><td>They take the credit risk. We made the introduction.</td></tr>
      </table>`;
  }
  if (tab === "flyer") {
    body = `<div class="card flyer"><p class="kicker">${esc(cfg().bankName)}</p><b>DO SUSU FOR A YEAR AND BUILD YOUR CREDIT</b><p>${esc(flyerText()).replace(/\n/g, "<br>")}</p></div>
      <button class="btn" id="copy-flyer">Copy flyer</button>
      <button class="btn-ghost" id="download-flyer">Download flyer</button>`;
  }
  if (tab === "market") {
    body = `<h3>Town hall</h3><pre class="mono">${esc(townHallText())}</pre><button class="btn" id="copy-hall">Copy town hall</button>
      <h3>Radio</h3><pre class="mono">${esc(radioText())}</pre><button class="btn" id="copy-radio">Copy radio</button>`;
  }
  if (tab === "limits") body = limitsHtml();
  return `<h2>Partnership pack</h2>
    <div class="choice-row">${tabs.map(function (item) { return `<button class="choice ${tab === item[0] ? "on" : ""}" data-pack-tab="${item[0]}">${item[1]}</button>`; }).join("")}</div>
    ${body}`;
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

const _agentPageP = agentPage;
agentPage = function (agent) {
  return _agentPageP(agent).replace(
    "<p class=\"hint\">You can also enroll",
    marketKit() + "<p class=\"hint\">You can also enroll"
  );
};
const _finishP = finishSignup;
finishSignup = function () {
  if (!state.funnel) state.funnel = { started: 0, finished: 0 };
  state.funnel.finished += 1;
  return _finishP();
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
    if (!state.funnel) state.funnel = { started: 0, finished: 0 };
    state.funnel.started += 1;
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
  document.querySelectorAll("[data-pack-tab]").forEach(function (el) {
    el.onclick = function () { state.packTab = el.dataset.packTab; render(); };
  });
  document.querySelectorAll("[data-pack-task]").forEach(function (el) {
    el.onchange = function () {
      state.packTasks[el.dataset.packTask] = el.checked;
      audit("Pack task " + el.dataset.packTask + (el.checked ? " done" : " open"));
      save();
    };
  });
  function copyNamed(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = function () {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      flash("Copied.");
      render();
    };
  }
  function downloadNamed(id, name, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.onclick = function () {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      a.download = name;
      a.click();
      flash("Downloaded.");
      render();
    };
  }
  copyNamed("copy-loi", loiText());
  copyNamed("copy-flyer", flyerText());
  copyNamed("copy-hall", townHallText());
  copyNamed("copy-radio", radioText());
  downloadNamed("download-loi", "digital-susu-letter.txt", loiText());
  downloadNamed("download-flyer", "digital-susu-flyer.txt", flyerText());
};

const _renderP = render;
render = function () {
  ensurePack();
  _renderP();
};
render();
