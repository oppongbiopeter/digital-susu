const FIRSTS = ["Ama", "Kwame", "Efua", "Kofi", "Abena", "Yaw", "Akosua", "Kojo", "Adwoa", "Kwesi", "Akua", "Esi", "Nana", "Afia", "Kwabena", "Adjoa", "Kweku", "Araba", "Fiifi", "Panyin"];
const LASTS = ["Mensah", "Owusu", "Boateng", "Asante", "Darko", "Appiah", "Frimpong", "Osei", "Agyeman", "Tetteh", "Quaye", "Ansah", "Amoah", "Addo", "Opoku", "Bediako", "Sarpong", "Gyasi", "Adu", "Nyarko"];
const MARKETS = ["Makola", "Kejetia", "Kaneshie", "Madina", "Takoradi"];
const BOOK_TARGET = 500;

function mailAddress(user) {
  if (user.email) return user.email;
  const slug = String(user.name || "member").toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
  return slug + "@mail.susu.test";
}
function sendMail(user, kind, subject, body) {
  if (!user) return;
  if (!state.outbox) state.outbox = [];
  state.outbox.unshift({
    id: uid("mail"), userId: user.id, to: mailAddress(user), kind: kind,
    subject: subject, body: body, at: new Date().toISOString(), read: false, status: "QUEUED"
  });
}
function ensureEcosystem() {
  if (!state.outbox) state.outbox = [];
  if (!state.claims) state.claims = [];
  if (!state.deletions) state.deletions = [];
  if (!state.remittances) state.remittances = [];
  if (cfg().lifePremium == null) cfg().lifePremium = 0.5;
  if (cfg().hospitalCash == null) cfg().hospitalCash = 100;
  state.users.forEach(function (u) {
    if (u.role === "CUSTOMER" && !u.email) u.email = mailAddress(u);
    if (u.mailReceipts == null) u.mailReceipts = true;
    if (u.remitSplit == null) u.remitSplit = false;
  });
  state.loans.forEach(function (l) {
    if (!l.covers) l.covers = { life: false, fire: false, health: false };
    if (l.deviceLocked == null) l.deviceLocked = false;
  });
  state.groups.forEach(function (g) {
    if (g.autoCover == null) g.autoCover = true;
  });
  if (!state.cohort500) seedBook();
}
function seedBook() {
  const have = state.users.filter(function (u) { return u.role === "CUSTOMER"; }).length;
  const agent = state.users.find(function (u) { return u.role === "AGENT"; });
  while (state.groups.length < 8) {
    const market = MARKETS[state.groups.length % MARKETS.length];
    state.groups.push({
      id: uid("grp"), name: market + " circle " + (state.groups.length + 1),
      code: ("MKT" + (state.groups.length + 1)).toUpperCase(),
      pool: 40 + state.groups.length * 15, memberIds: [], createdAt: todayISO(-20), autoCover: true
    });
  }
  const need = BOOK_TARGET - have;
  for (let i = 0; i < need; i++) {
    const n = have + i;
    const name = FIRSTS[n % FIRSTS.length] + " " + LASTS[Math.floor(n / FIRSTS.length) % LASTS.length] + " " + (n + 1);
    const phone = "024" + String(3000000 + n).slice(-7);
    const card = "GHA-" + String(800000000 + n) + "-" + (n % 10);
    const roll = n % 20;
    const fast = roll === 0;
    const score850n = fast ? 710 + (n % 40) : 520 + (n % 180);
    const user = {
      id: uid("usr"), role: "CUSTOMER", pin: "1234", name: name, phone: phone, ghanaCard: card,
      provider: ["MTN", "Telecel", "AT Money"][n % 3], momo: phone,
      score: Math.round((score850n - 300) / 5.5), score850: score850n,
      scoreLog: [{ date: todayISO(-n % 40), score: score850n, delta: 0 }],
      consents: { scan: true, bureau: true, terms: true }, wallet: (n % 40) + 5,
      track: fast ? "FAST" : "BUILDER", createdAt: todayISO(-(n % 200) - 1),
      channel: n % 11 === 0 ? "USSD_385" : n % 7 === 0 ? "AGENT" : "NATIVE_APP",
      agentId: n % 7 === 0 && agent ? agent.id : null,
      market: MARKETS[n % MARKETS.length],
      email: name.toLowerCase().replace(/[^a-z0-9]+/g, ".") + "@mail.susu.test",
      mailReceipts: true, remitSplit: n % 5 === 0
    };
    state.users.push(user);
    if (user.agentId && agent) agent.enrolled = (agent.enrolled || 0) + 1;
    if (fast) {
      state.fastPool.push({ id: uid("pool"), userId: user.id, score: score850n, status: n % 40 === 0 ? "SENT" : "WAITING", at: todayISO(-3), sentAt: n % 40 === 0 ? todayISO(-1) : null });
      continue;
    }
    const savings = [200, 400, 600, 1000, 2000][n % 5];
    let status = "ACTIVE";
    let months = n % 12;
    if (roll === 1) { status = "GRACE"; months = Math.max(1, months); }
    else if (roll === 2) { status = "DEFAULT_CLOSED"; months = 2; }
    else if (roll === 3) { status = "MATURED_SUCCESS"; months = 12; }
    const tier = tierFor(months, status);
    const loan = {
      id: uid("loan"), userId: user.id, principal: savings, savings: savings,
      locked: status === "ACTIVE" || status === "GRACE" ? savings : 0,
      contributed: status === "MATURED_SUCCESS" ? savings : 0,
      months: months, maxMonths: 12, status: status, tier: tier,
      limit: status === "MATURED_SUCCESS" ? cfg().platinumLimit : limitFor(tier, cfg()),
      discount: 0, nextDue: status === "ACTIVE" || status === "GRACE" ? todayISO(roll === 1 ? -2 : 4 + (n % 20)) : null,
      graceStart: status === "GRACE" ? todayISO(-2) : null,
      openedAt: todayISO(-(months * 30) - 2), groupId: null, offerStatus: status === "MATURED_SUCCESS" ? "AVAILABLE" : "LOCKED",
      autopay: roll !== 1 && roll !== 4, misses: status === "GRACE" || status === "DEFAULT_CLOSED" ? 1 : 0, pushed: true,
      covers: { life: months >= 1, fire: months >= 3, health: months >= 6 },
      deviceImei: months >= 6 ? "35" + String(1000000000000 + n).slice(0, 13) : null,
      deviceLocked: false
    };
    if (n % 3 === 0) {
      const g = state.groups[n % state.groups.length];
      loan.groupId = g.id;
      g.memberIds.push(user.id);
    }
    state.loans.push(loan);
    if (months >= 6) {
      state.devices.push({ id: uid("dev"), userId: user.id, name: "Samsung Galaxy A05", price: 250, status: "FUNDED", at: loan.openedAt, imei: loan.deviceImei });
    }
  }
  state.cohort500 = true;
  audit("Book filled to " + state.users.filter(function (u) { return u.role === "CUSTOMER"; }).length + " customers");
}

function mailView(user) {
  const rows = state.outbox.filter(function (m) { return m.userId === user.id; });
  return `${banners()}<p class="kicker">Mail</p><h2>Letters from the box</h2>
    <p class="hint">Missed months, grace, group cover, remittances, and releases are written here and queued for ${esc(mailAddress(user))}. The pilot holds them until the bank mail relay is switched on.</p>
    <label class="toggle"><input type="checkbox" id="mail-receipts" ${user.mailReceipts ? "checked" : ""}><span>Email me when a month is marked or missed</span></label>
    <button class="btn btn-block" id="save-mail">Save</button>
    <div class="field"><label>Email</label><input id="mail-to" value="${esc(user.email || "")}"></div>
    <div class="list">${rows.length ? rows.map(function (m) {
      return `<div class="card"><b>${esc(m.subject)}</b><div class="small muted">${esc(m.at.slice(0, 16).replace("T", " "))} · ${esc(m.status)} · ${esc(m.to)}</div><p class="hint">${esc(m.body)}</p></div>`;
    }).join("") : `<p class="hint">No letters yet. A missed month will land here.</p>`}</div>`;
}
function coverView(user, loan) {
  if (!loan) return `${banners()}<h2>No box to cover</h2><p class="hint">Fast-track files are with the bank. Covers sit on a savings box.</p>`;
  const c = loan.covers || { life: false, fire: false, health: false };
  const silver = ["SILVER", "GOLD", "PLATINUM"].indexOf(loan.tier) >= 0;
  const gold = ["GOLD", "PLATINUM"].indexOf(loan.tier) >= 0;
  const mine = state.claims.filter(function (x) { return x.userId === user.id; });
  return `${banners()}<p class="kicker">Covers</p><h2>If the market stops</h2>
    <p class="hint">These sit inside the repayment. They are not a second bill. The insurer pays the bank. You file the claim here.</p>
    <label class="toggle"><input type="checkbox" id="cov-life" ${c.life ? "checked" : ""}><span>Credit life, ${money(cfg().lifePremium)} inside the month. If you cannot continue, the insurer clears the box for your family.</span></label>
    <label class="toggle"><input type="checkbox" id="cov-fire" ${c.fire ? "checked" : ""} ${silver ? "" : "disabled"}><span>Market fire and flood. Unlocks at Silver.</span></label>
    <label class="toggle"><input type="checkbox" id="cov-health" ${c.health ? "checked" : ""} ${gold ? "" : "disabled"}><span>Hospital cash, ${money(cfg().hospitalCash)} a day, from Gold.</span></label>
    <button class="btn btn-block" id="save-cover">Save covers</button>
    <h3>Ask the insurer</h3>
    <div class="field"><label>What happened</label><select id="claim-kind"><option value="life">I cannot continue (credit life)</option><option value="fire">Fire or flood at the stall</option><option value="health">I am in hospital</option></select></div>
    <button class="btn-ghost btn-block" id="file-claim">File a claim</button>
    ${mine.map(function (cl) { return `<div class="row-card"><span>${esc(cl.kind)}</span><b>${esc(cl.status)}</b></div>`; }).join("")}
    ${loan.deviceImei ? `<div class="notice">Phone on finance, IMEI ${esc(loan.deviceImei)}. ${loan.deviceLocked ? "Locked because a month was missed. Non-emergency features stay off until the month is marked." : "Unlocked. A missed month locks it."}</div>` : ""}`;
}
function remitView(user, loan) {
  const rows = state.remittances.filter(function (r) { return r.userId === user.id; });
  return `${banners()}<p class="kicker">Money from abroad</p><h2>Remittance split</h2>
    <p class="hint">When people send money home, you can let the app mark this month from that transfer before the rest reaches your wallet. The savings already at the bank does not move twice.</p>
    <label class="toggle"><input type="checkbox" id="remit-on" ${user.remitSplit ? "checked" : ""}><span>Split incoming remittances into this month's repayment</span></label>
    <button class="btn-ghost btn-block" id="save-remit">Save</button>
    <div class="field"><label>Simulate an incoming transfer</label><input id="remit-amt" inputmode="numeric" placeholder="500"></div>
    <div class="field"><label>Sender</label><input id="remit-from" placeholder="Kwame in London"></div>
    <button class="btn btn-block" id="do-remit" ${loan ? "" : "disabled"}>Receive it</button>
    <div class="list" style="margin-top:10px">${rows.map(function (r) {
      return `<div class="row-card"><div><b>${esc(r.sender)}</b><div class="small muted">${esc(r.date)} · ${esc(r.action)}</div></div><span>${money(r.amount)}</span></div>`;
    }).join("") || `<p class="hint">No remittances yet.</p>`}</div>`;
}
function privacyView(user) {
  const mine = state.deletions.filter(function (d) { return d.userId === user.id; });
  return `${banners()}<p class="kicker">Act 843</p><h2>Close my record</h2>
    <p class="hint">You can ask us to forget the phone scan and the contact details. The bank keeps the savings ledger for the years the law requires. We do not keep chats, passwords, or photos, because we never took them.</p>
    ${mine.map(function (d) { return `<div class="notice">${esc(d.status)} since ${esc(d.at)}</div>`; }).join("")}
    <button class="btn btn-block" id="ask-delete" ${mine.some(function (d) { return d.status === "ASKED"; }) ? "disabled" : ""}>Ask to be forgotten</button>`;
}

function auditAdmin() {
  const refs = {};
  const dupes = [];
  state.ledger.forEach(function (t) {
    if (!t.ref) return;
    if (refs[t.ref]) dupes.push(t.ref);
    refs[t.ref] = true;
  });
  const negative = state.loans.filter(function (l) { return Number(l.locked) < 0; });
  const staleGrace = state.loans.filter(function (l) {
    return l.status === "GRACE" && l.graceStart && daysBetween(l.graceStart, todayISO(0)) > cfg().graceDays;
  });
  const waiting = state.fastPool.filter(function (p) { return p.status === "WAITING"; }).length;
  const queued = state.outbox.filter(function (m) { return m.status === "QUEUED"; }).length;
  function row(ok, label, detail) {
    return `<div class="row-card"><div><b>${esc(label)}</b><div class="small muted">${esc(detail)}</div></div><span class="badge ${ok ? "b-ok" : "b-warn"}">${ok ? "Clear" : "Look"}</span></div>`;
  }
  return `<h2>Nightly ledger audit</h2>
    <p class="hint">The same checks a read-only job would run. Bureau filing is still the bank's. This only proves our book is even.</p>
    <div class="list">
      ${row(!dupes.length, "Duplicate payment references", dupes.length ? dupes.slice(0, 3).join(", ") : "Every reference is unique")}
      ${row(!negative.length, "Escrow never below zero", negative.length + " boxes under zero")}
      ${row(!staleGrace.length, "Grace older than " + cfg().graceDays + " days", staleGrace.length + " still open")}
      ${row(true, "Fast-track files waiting on you", waiting + " not sent")}
      ${row(true, "Mail queued for the relay", queued + " letters")}
    </div>
    <button class="btn" id="hand-mail">Hand queued mail to the relay</button>`;
}
function claimsAdmin() {
  return `<h2>Cover claims</h2>
    <table><tr><th>Customer</th><th>Kind</th><th>Status</th><th></th></tr>
    ${state.claims.map(function (c) {
      const u = state.users.find(function (x) { return x.id === c.userId; });
      return `<tr><td>${esc(u ? u.name : "")}</td><td>${esc(c.kind)}</td><td>${esc(c.status)}</td><td>${c.status === "ASKED" ? `<button class="chip" data-claim="${c.id}">Pay</button>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="4">No claims.</td></tr>`}</table>`;
}
function deletionAdmin() {
  return `<h2>Forget-me queue</h2>
    <p class="hint">Approving strips the name, phone, Ghana Card, and email. The loan row stays, with no person attached, because the bank must keep the money movement.</p>
    <table><tr><th>Was</th><th>Status</th><th></th></tr>
    ${state.deletions.map(function (d) {
      return `<tr><td>${esc(d.label)}</td><td>${esc(d.status)}</td><td>${d.status === "ASKED" ? `<button class="chip" data-forget="${d.id}">Forget</button>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="3">Empty.</td></tr>`}</table>`;
}
function mailAdmin() {
  const rows = state.outbox.slice(0, 30);
  return `<h2>Outbox</h2><p class="hint">${state.outbox.length} letters. Showing the latest 30. Nothing leaves this pilot until you hand the queue to the relay.</p>
    <button class="btn" id="hand-mail">Mark queued as handed over</button>
    <table><tr><th>To</th><th>Subject</th><th>Status</th></tr>
    ${rows.map(function (m) { return `<tr><td>${esc(m.to)}</td><td>${esc(m.subject)}</td><td>${esc(m.status)}</td></tr>`; }).join("")}</table>`;
}

const _customers = customersAdmin;
customersAdmin = function () {
  const q = String(state.customerQuery || "").toLowerCase();
  let rows = state.users.filter(function (u) { return u.role === "CUSTOMER"; });
  const total = rows.length;
  if (q) rows = rows.filter(function (u) { return (u.name + " " + u.phone + " " + u.ghanaCard + " " + (u.market || "")).toLowerCase().indexOf(q) >= 0; });
  const shown = rows.slice(0, 25);
  return `<h2>Customers</h2>
    <p class="hint">${total} on the book. Search, then open one. PIN on the dummy book is 1234.</p>
    <div class="field"><label>Search name, phone, card, market</label><input id="cust-q" value="${esc(state.customerQuery || "")}" placeholder="Makola or 0243"></div>
    <table><tr><th>Name</th><th>Phone</th><th>Market</th><th>Path</th><th></th></tr>
    ${shown.map(function (u) {
      return `<tr><td>${esc(u.name)}</td><td>${esc(u.phone)}</td><td>${esc(u.market || "")}</td><td>${esc(u.track || "BUILDER")}</td><td><button class="chip" data-impersonate="${u.id}">Open</button></td></tr>`;
    }).join("")}</table>
    <p class="hint">Showing ${shown.length} of ${rows.length}.</p>`;
};
loansAdmin = function () {
  const q = String(state.loanQuery || "").toLowerCase();
  let rows = state.loans.slice();
  if (q) rows = rows.filter(function (l) {
    const u = state.users.find(function (x) { return x.id === l.userId; });
    return ((u ? u.name : "") + " " + l.status + " " + l.tier).toLowerCase().indexOf(q) >= 0;
  });
  const shown = rows.slice(0, 25);
  return `<h2>Savings boxes</h2>
    <div class="field"><label>Search</label><input id="loan-q" value="${esc(state.loanQuery || "")}" placeholder="Grace or Platinum"></div>
    <table><tr><th>Customer</th><th>Status</th><th>Tier</th><th>Months</th><th>At the bank</th></tr>
    ${shown.map(function (l) {
      const u = state.users.find(function (x) { return x.id === l.userId; });
      return `<tr><td>${esc(u ? u.name : "")}</td><td>${esc(l.status)}</td><td>${esc(l.tier)}</td><td>${l.months}/12</td><td>${money(l.locked)}</td></tr>`;
    }).join("")}</table><p class="hint">${rows.length} boxes. Showing ${shown.length}.</p>`;
};
collectionsAdmin = function () {
  const rows = state.loans.filter(function (l) { return l.status === "GRACE" || (l.nextDue && l.nextDue <= todayISO(0) && l.status === "ACTIVE"); });
  return `<h2>Grace and set-off</h2>
    <p class="hint">${rows.length} need a look. The rest are not due. Day 16 closes the box and returns what is still theirs.</p>
    <table><tr><th>Customer</th><th>Status</th><th>Since</th><th></th></tr>
    ${rows.slice(0, 40).map(function (l) {
      const u = state.users.find(function (x) { return x.id === l.userId; });
      return `<tr><td>${esc(u ? u.name : "")}</td><td>${esc(l.status)}</td><td>${esc(l.graceStart || l.nextDue || "")}</td><td>
        <button class="chip" data-grace="${l.id}">Grace</button>
        <button class="chip" data-setoff="${l.id}">Set off</button></td></tr>`;
    }).join("")}</table>`;
};
const _command = commandAdmin;
commandAdmin = function () {
  const html = _command();
  const queued = state.loans.filter(function (l) { return l.status === "GRACE"; }).length;
  return html.replace("Needs a human", "Needs a human (" + queued + " in grace)");
};

const _adminViewE = adminView;
adminView = function (user) {
  if (state.adminView === "audit") return auditAdmin();
  if (state.adminView === "mail") return mailAdmin();
  if (state.adminView === "claims") return claimsAdmin();
  if (state.adminView === "forget") return user.role === "SUPER" || user.role === "OPS" ? deletionAdmin() : `<h2>Not your desk</h2>`;
  return _adminViewE(user);
};
const _shellE = adminShell;
adminShell = function (user) {
  return _shellE(user).replace(
    'data-admin="agents">Agents</button>',
    'data-admin="agents">Agents</button><button class="chip" data-admin="audit">Audit</button><button class="chip" data-admin="mail">Outbox</button><button class="chip" data-admin="claims">Claims</button><button class="chip" data-admin="forget">Forget-me</button>'
  );
};
const _moreE = moreView;
moreView = function (user) {
  const html = _moreE(user);
  const marker = 'data-go="ussd"';
  const at = html.indexOf(marker);
  if (at < 0) return html;
  const end = html.indexOf("</button>", at);
  const extra = '<button class="row-card" data-go="mail"><b>Mail</b><span>›</span></button><button class="row-card" data-go="cover"><b>Covers</b><span>›</span></button><button class="row-card" data-go="remit"><b>Remittance split</b><span>›</span></button><button class="row-card" data-go="privacy"><b>Close my record</b><span>›</span></button>';
  return html.slice(0, end + 9) + extra + html.slice(end + 9);
};
const _custE = customerView;
customerView = function (user) {
  const loan = loanOf(user.id);
  if (state.view === "mail") return mailView(user);
  if (state.view === "cover") return coverView(user, loan);
  if (state.view === "remit") return remitView(user, loan);
  if (state.view === "privacy") return privacyView(user);
  return _custE(user);
};

function snapshotLoans() {
  const map = {};
  state.loans.forEach(function (l) { map[l.id] = l.status; });
  return map;
}
function mailStatusChanges(before) {
  state.loans.forEach(function (l) {
    const user = state.users.find(function (u) { return u.id === l.userId; });
    if (!user || before[l.id] === l.status) return;
    if (l.status === "GRACE") {
      sendMail(user, "MISSED", "A month was missed", "Your box opened a " + cfg().graceDays + "-day grace on " + (l.graceStart || todayISO(0)) + ". Mark the month before it closes. Nothing is reported late yet.");
      if (l.deviceImei) {
        l.deviceLocked = true;
        state.devices.forEach(function (d) { if (d.userId === user.id && d.status === "FUNDED") d.status = "LOCKED"; });
        sendMail(user, "DEVICE", "Financed phone is locked", "IMEI " + l.deviceImei + " keeps calls to emergency numbers. Mark the month and ops will unlock it.");
      }
    }
    if (l.status === "DEFAULT_CLOSED") {
      sendMail(user, "SETOFF", "The box was closed", "The grace ran out. What was still yours is back in the wallet. You do not owe the bank.");
    }
    if (l.status === "MATURED_SUCCESS" && before[l.id] !== "MATURED_SUCCESS") {
      sendMail(user, "DONE", "Twelve months are done", "Your savings are released. The bank has the record.");
    }
  });
}
const _payE = postPayment;
postPayment = function (user, loan, channel) {
  const before = snapshotLoans();
  const result = _payE(user, loan, channel);
  if (user && user.mailReceipts && loan && state.ledger.length) {
    const last = state.ledger[state.ledger.length - 1];
    if (last && last.userId === user.id && last.type === "REPAYMENT") {
      sendMail(user, "PAID", "Month " + loan.months + " is marked", "We marked " + money(last.amount) + " from the savings already at the bank. Channel " + channel + ".");
    }
  }
  if (!state._inBill) mailStatusChanges(before);
  return result;
};
const _billE = billingDay;
billingDay = function () {
  state._inBill = true;
  const before = snapshotLoans();
  state.loans.forEach(function (loan) {
    if (loan.autopay) return;
    if (loan.status !== "ACTIVE" && loan.status !== "GRACE") return;
    if (!loan.nextDue || loan.nextDue > todayISO(0)) return;
    if (!loan.groupId) return;
    const group = state.groups.find(function (g) { return g.id === loan.groupId; });
    if (!group || group.autoCover === false || group.pool < 5) return;
    const user = state.users.find(function (u) { return u.id === loan.userId; });
    const months = loan.months;
    postPayment(user, loan, "GROUP_PEER_RECOVERY");
    if (loan.months === months) return;
    group.pool = Math.round((group.pool - 5) * 100) / 100;
    sendMail(user, "PEER", "Your circle covered this month", group.name + " put GH₵ 5.00 from the welfare pot so this month is not a miss.");
  });
  _billE();
  state._inBill = false;
  mailStatusChanges(before);
};

function receiveRemittance(user) {
  const amount = Number(document.getElementById("remit-amt").value);
  const sender = document.getElementById("remit-from").value.trim() || "Family";
  if (!(amount > 0)) return fail("Enter how much arrived."), render();
  const loan = loanOf(user.id);
  let action = "All to wallet";
  let rest = amount;
  if (user.remitSplit && loan && (loan.status === "ACTIVE" || loan.status === "GRACE") && amount >= monthDue(loan)) {
    const due = monthDue(loan);
    rest = Math.round((amount - due) * 100) / 100;
    postPayment(user, loan, "REMITTANCE_SPLIT");
    action = "Month marked, " + money(rest) + " to wallet";
  }
  user.wallet = Math.round((user.wallet + rest) * 100) / 100;
  state.remittances.unshift({ id: uid("rem"), userId: user.id, amount: amount, sender: sender, date: todayISO(0), action: action });
  sendMail(user, "REMIT", "Remittance from " + sender, money(amount) + " arrived. " + action + ".");
  flash(action);
  render();
}
function handMail() {
  let n = 0;
  state.outbox.forEach(function (m) { if (m.status === "QUEUED") { m.status = "HANDED_TO_RELAY"; n++; } });
  audit("Mail relay took " + n + " letters");
  flash(n + " letters handed to the relay.");
  render();
}
function forgetPerson(id) {
  const row = state.deletions.find(function (d) { return d.id === id; });
  if (!row) return;
  const user = state.users.find(function (u) { return u.id === row.userId; });
  if (user) {
    user.name = "Forgotten record";
    user.phone = "0000000000";
    user.momo = "";
    user.ghanaCard = "GHA-000000000-0";
    user.email = "forgotten@mail.susu.test";
    user.scoreLog = [];
    user.pin = "0000";
  }
  row.status = "FORGOTTEN";
  audit("Forgot a customer record");
  flash("Contact details removed. The money rows stay.");
  render();
}

const _bindE = bind;
bind = function () {
  _bindE();
  const q = document.getElementById("cust-q");
  if (q) q.onchange = function () { state.customerQuery = q.value; render(); };
  const lq = document.getElementById("loan-q");
  if (lq) lq.onchange = function () { state.loanQuery = lq.value; render(); };
  const saveMail = document.getElementById("save-mail");
  if (saveMail) saveMail.onclick = function () {
    const user = sessionUser();
    user.email = document.getElementById("mail-to").value.trim();
    user.mailReceipts = document.getElementById("mail-receipts").checked;
    flash("Mail saved.");
    render();
  };
  const saveCover = document.getElementById("save-cover");
  if (saveCover) saveCover.onclick = function () {
    const loan = loanOf(sessionUser().id);
    loan.covers = {
      life: document.getElementById("cov-life").checked,
      fire: document.getElementById("cov-fire").checked,
      health: document.getElementById("cov-health").checked
    };
    flash("Covers saved. They stay inside the repayment.");
    render();
  };
  const fileClaim = document.getElementById("file-claim");
  if (fileClaim) fileClaim.onclick = function () {
    const user = sessionUser();
    const kind = document.getElementById("claim-kind").value;
    state.claims.unshift({ id: uid("clm"), userId: user.id, kind: kind, status: "ASKED", at: todayISO(0) });
    sendMail(user, "CLAIM", "We have your claim", "A " + kind + " claim is with ops. The insurer pays the bank, not a new loan.");
    flash("Claim filed.");
    render();
  };
  const saveRemit = document.getElementById("save-remit");
  if (saveRemit) saveRemit.onclick = function () {
    sessionUser().remitSplit = document.getElementById("remit-on").checked;
    flash(sessionUser().remitSplit ? "Remittances will mark the month first." : "Remittances go straight to the wallet.");
    render();
  };
  const doRemit = document.getElementById("do-remit");
  if (doRemit) doRemit.onclick = function () { receiveRemittance(sessionUser()); };
  const askDel = document.getElementById("ask-delete");
  if (askDel) askDel.onclick = function () {
    const user = sessionUser();
    state.deletions.unshift({ id: uid("del"), userId: user.id, label: user.name, status: "ASKED", at: todayISO(0) });
    sendMail(user, "PRIVACY", "We received your request", "Ops will strip the contact details. The bank keeps the savings movements.");
    flash("Request is with ops.");
    render();
  };
  document.querySelectorAll("[data-claim]").forEach(function (el) {
    el.onclick = function () {
      const claim = state.claims.find(function (c) { return c.id === el.dataset.claim; });
      const user = state.users.find(function (u) { return u.id === claim.userId; });
      claim.status = "PAID";
      if (claim.kind === "health") user.wallet = Math.round((user.wallet + cfg().hospitalCash) * 100) / 100;
      sendMail(user, "CLAIM", "Claim paid", claim.kind === "health" ? money(cfg().hospitalCash) + " hospital cash is in the wallet." : "The insurer cleared it with the bank.");
      flash("Claim marked paid.");
      render();
    };
  });
  document.querySelectorAll("[data-forget]").forEach(function (el) {
    el.onclick = function () { forgetPerson(el.dataset.forget); };
  });
  document.querySelectorAll("#hand-mail").forEach(function (el) { el.onclick = handMail; });
};

const _renderE = render;
render = function () {
  ensureEcosystem();
  _renderE();
};

render();
