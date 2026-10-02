function ensureBank() {
  if (!state.connection) {
    state.connection = {
      status: "SANDBOX_CONNECTED",
      core: "Temenos T24 sandbox",
      apiBase: "https://sandbox.amanfo.bank/mcb/v1",
      clientId: "mcb_amanfo_sandbox",
      clientSecret: "sbx_9f3c_amanfo_escrow_token",
      webhookUrl: "https://sandbox.amanfo.bank/hooks/mcb",
      escrowGl: "214500-MCB-ESCROW",
      collectionGl: "214510-MCB-COLLECTION",
      lastSync: todayISO(0),
      scopes: ["escrow.read", "escrow.lock", "setoff.confirm", "customers.read", "treasury.read", "users.manage"],
      pushEnabled: true
    };
  }
  if (!state.anomalies) {
    state.anomalies = [{
      id: "anom-1",
      code: "CORE_LEDGER_SYNC_ANOMALY",
      detail: "Telco debited a wallet, core sub-ledger still in grace past the 72-hour window.",
      loanHint: "Kofi Asante",
      status: "OPEN"
    }];
  }
  if (!state.bankUsersReady) {
    [
      ["bank.admin", "1111", "Akua Boateng", "BANK_ADMIN", "0244002001"],
      ["treasury.osei", "2222", "Kojo Osei", "TREASURY", "0244002002"],
      ["risk.mensah", "3333", "Abena Mensah", "RISK", "0244002003"],
      ["credit.owusu", "4444", "Yaw Owusu", "CREDIT", "0244002004"]
    ].forEach(function (row) {
      if (state.users.some(function (u) { return u.username === row[0]; })) return;
      state.users.push({
        id: uid("usr"), role: row[3], pin: row[1], username: row[0], name: row[2], phone: row[4],
        ghanaCard: "", provider: "", momo: row[4], score: null, consents: {}, wallet: 0,
        createdAt: todayISO(-10), channel: "BANK_PORTAL", active: true
      });
    });
    state.bankUsersReady = true;
  }
  state.users.forEach(function (u) { if (u.active == null && String(u.role).indexOf("BANK_") === 0) u.active = true; });
  if (!state.bankView) state.bankView = "home";
}
function isBank(user) { return user && String(user.role).indexOf("BANK_") === 0; }
function bankCan(user, area) {
  if (!user) return false;
  if (user.role === "SUPER" || user.role === "BANK_ADMIN") return true;
  if (area === "home" || area === "customers" || area === "training") return true;
  if (area === "treasury") return user.role === "TREASURY";
  if (area === "setoff" || area === "reconcile") return user.role === "RISK";
  if (area === "credit") return user.role === "CREDIT";
  return false;
}
function lockedTotal() {
  return state.loans.filter(function (l) { return l.status === "ACTIVE" || l.status === "GRACE"; }).reduce(function (s, l) { return s + Number(l.locked); }, 0);
}
function bankNav(user) {
  const items = [["home", "Portfolio"], ["customers", "Customers"], ["training", "Staff guide"]];
  if (bankCan(user, "treasury")) items.push(["treasury", "Treasury"]);
  if (bankCan(user, "setoff")) items.push(["setoff", "Set-off"], ["reconcile", "Reconcile"]);
  if (bankCan(user, "credit")) items.push(["credit", "Graduation book"]);
  if (user.role === "BANK_ADMIN" || user.role === "SUPER") items.push(["users", "Users"], ["connect", "Connection"], ["audit", "Audit"]);
  return `<div class="bank-nav">${items.map(function (it) {
    return `<button class="chip ${state.bankView === it[0] ? "on" : ""}" data-bank="${it[0]}">${it[1]}</button>`;
  }).join("")}</div>`;
}
function bankPage(user) {
  const viewing = user.role === "SUPER";
  return `<div class="app-shell bank">
    <div class="bank-top">
      <div class="brand"><div class="mark"><span>₵</span></div><div><h1>${esc(cfg().bankName)}</h1><p>Core sub-ledger portal · ${esc(state.connection.status)}</p></div></div>
      <div class="demo-switch">
        <span>${esc(user.name)} · ${esc(user.role)}</span>
        <button class="chip" data-jump="customer">Customer</button>
        <button class="chip" data-jump="ops">Ops</button>
        <button class="chip" data-jump="super">Super admin</button>
        <button class="chip on" data-jump="bank">Bank</button>
        ${viewing ? `<button class="btn-ghost" id="leave-bank">Back to MCB console</button>` : `<button class="btn-ghost" data-logout="1">Log out</button>`}
      </div>
    </div>
    ${viewing ? `<div class="notice">Super admin view. You can see every bank screen, secret, and user. Bank staff cannot see MCB engine controls.</div>` : ""}
    ${banners()}
    <section class="wide">
      ${bankNav(user)}
      ${bankBody(user)}
    </section>
  </div>`;
}
function bankBody(user) {
  const v = state.bankView;
  if (!bankCan(user, v) && v !== "users" && v !== "connect" && v !== "audit") return `<h2>Not on your desk</h2><p class="hint">Ask a bank admin if you need this screen.</p>`;
  if (v === "customers") return bankCustomers();
  if (v === "treasury") return bankTreasury();
  if (v === "setoff") return bankSetoff();
  if (v === "credit") return bankCredit();
  if (v === "users") return bankUsers(user);
  if (v === "connect") return bankConnect(user);
  if (v === "training") return bankTraining();
  if (v === "reconcile") return bankReconcile();
  if (v === "audit") return bankAudit();
  return bankHome();
}
function bankHome() {
  const customers = state.users.filter(function (u) { return u.role === "CUSTOMER"; });
  const grace = state.loans.filter(function (l) { return l.status === "GRACE"; }).length;
  const matured = state.loans.filter(function (l) { return l.status === "MATURED_SUCCESS"; }).length;
  return `<p class="kicker">Executive desk</p><h2>Builder book</h2>
    <div class="kpi-grid">
      <div class="stat"><span>Customers</span><b>${customers.length}</b></div>
      <div class="stat"><span>Locked escrow</span><b>${money(lockedTotal())}</b></div>
      <div class="stat"><span>In grace</span><b>${grace}</b></div>
      <div class="stat"><span>Graduated</span><b>${matured}</b></div>
    </div>
    <p class="hint">This is not a cash-loan book. Principal sits in ${esc(state.connection.escrowGl)} under the bank's custody. Builder-loan NPL target is zero. Graduation lines are a separate book.</p>
    <div class="notice">Last core sync ${esc(state.connection.lastSync)} · ${esc(state.connection.core)} · API ${esc(state.connection.apiBase)}</div>`;
}
function bankCustomers() {
  return `<h2>Customers on the sub-ledger</h2>
    <table><tr><th>Name</th><th>Ghana Card</th><th>MoMo</th><th>Status</th><th>Tier</th><th>Locked</th><th>Saved</th></tr>
    ${state.loans.map(function (l) {
      const u = state.users.find(function (x) { return x.id === l.userId; });
      const card = u.ghanaCard ? u.ghanaCard.slice(0, 7) + "···" + u.ghanaCard.slice(-2) : "";
      return `<tr><td>${esc(u.name)}</td><td>${esc(card)}</td><td>${esc(u.provider)} ${esc(u.phone)}</td><td>${esc(l.status)}</td><td>${esc(l.tier)}</td><td>${money(l.locked)}</td><td>${money(l.contributed)}</td></tr>`;
    }).join("")}</table>
    <div style="height:8px"></div><button class="btn-ghost" id="bank-export">Export portfolio</button>`;
}
function bankTreasury() {
  const locked = lockedTotal();
  return `<h2>Treasury pool</h2>
    <div class="kpi-grid">
      <div class="stat"><span>Non-withdrawable float</span><b>${money(locked)}</b></div>
      <div class="stat"><span>Escrow GL</span><b>${esc(state.connection.escrowGl)}</b></div>
      <div class="stat"><span>Collection GL</span><b>${esc(state.connection.collectionGl)}</b></div>
      <div class="stat"><span>Sweep each month</span><b>${money(cfg().bankSweep)} / box</b></div>
    </div>
    <p class="hint">Map this residual against 91-day Bank of Ghana paper. The float falls by the sweep each month. Do not treat opening balance as permanent. Yield stays with the bank. The technology firm does not touch this GL.</p>
    <div class="mono">GET ${esc(state.connection.apiBase)}/treasury/float
Authorization: Bearer ${esc(state.connection.clientId)}
{ "escrowGl": "${esc(state.connection.escrowGl)}", "locked": ${locked.toFixed(2)}, "asOf": "${esc(state.connection.lastSync)}" }</div>`;
}
function bankSetoff() {
  return `<h2>Set-off confirmations</h2>
    <p class="hint">MCB ops can flag a box. Posting to the core needs a bank risk confirm. Customer still owes nothing after set-off. Personal drops refund to MoMo.</p>
    <table><tr><th>Customer</th><th>Status</th><th>Locked</th><th>Core post</th><th></th></tr>
    ${state.loans.filter(function (l) { return l.status === "GRACE" || l.status === "DEFAULT_CLOSED" || l.corePosted; }).map(function (l) {
      const u = state.users.find(function (x) { return x.id === l.userId; });
      return `<tr><td>${esc(u.name)}</td><td>${esc(l.status)}</td><td>${money(l.locked)}</td><td>${l.corePosted ? "Posted" : "Pending"}</td><td>${l.status === "GRACE" ? `<button class="chip" data-bank-setoff="${l.id}">Confirm set-off to core</button>` : ""}</td></tr>`;
    }).join("")}</table>`;
}
function bankCredit() {
  return `<h2>Graduation requests</h2>
    <p class="hint">The app originates. The bank funds. A GH₵ ${cfg().platinumLimit} line is not the builder loan and can produce NPLs.</p>
    <table><tr><th>Customer</th><th>Tier</th><th>Limit</th><th>Request</th><th></th></tr>
    ${state.loans.filter(function (l) { return l.status === "MATURED_SUCCESS" || l.offerStatus === "REQUESTED"; }).map(function (l) {
      const u = state.users.find(function (x) { return x.id === l.userId; });
      return `<tr><td>${esc(u.name)}</td><td>${esc(l.tier)}</td><td>${money(l.limit)}</td><td>${esc(l.offerStatus)}</td><td>${l.offerStatus === "REQUESTED" ? `<button class="chip" data-fund="${l.id}">Mark funded on core</button>` : ""}</td></tr>`;
    }).join("")}</table>`;
}
function bankUsers(actor) {
  const staff = state.users.filter(function (u) { return String(u.role).indexOf("BANK_") === 0; });
  return `<h2>Bank users</h2>
    <p class="hint">Bank admin creates desk logins. Super admin sees them too, and can suspend. Roles: admin, treasury, risk, credit.</p>
    <table><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr>
    ${staff.map(function (u) {
      return `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td>${u.active === false ? "Suspended" : "Active"}</td><td><button class="chip" data-suspend="${u.id}">${u.active === false ? "Restore" : "Suspend"}</button></td></tr>`;
    }).join("")}</table>
    <h3>Add a user</h3>
    <div class="grid-2">
      <div class="field"><label>Name</label><input id="bu-name" placeholder="Esi Ampofo"></div>
      <div class="field"><label>Username</label><input id="bu-user" placeholder="risk.ampofo"></div>
      <div class="field"><label>Temporary PIN</label><input id="bu-pin" maxlength="4" placeholder="4 digits"></div>
      <div class="field"><label>Role</label><select id="bu-role"><option>BANK_ADMIN</option><option>TREASURY</option><option>RISK</option><option>CREDIT</option></select></div>
    </div>
    <button class="btn" id="add-bank-user">Create login</button>`;
}
function bankConnect(user) {
  const secret = user.role === "SUPER" ? state.connection.clientSecret : state.connection.clientSecret.slice(0, 4) + "········";
  return `<h2>Connection to the core</h2>
    <div class="list">
      <div class="row-card"><span>Status</span><b>${esc(state.connection.status)}</b></div>
      <div class="row-card"><span>Core</span><b>${esc(state.connection.core)}</b></div>
      <div class="row-card"><span>API base</span><b>${esc(state.connection.apiBase)}</b></div>
      <div class="row-card"><span>Client id</span><b>${esc(state.connection.clientId)}</b></div>
      <div class="row-card"><span>Token</span><b>${esc(secret)}</b></div>
      <div class="row-card"><span>Their webhook</span><b>${esc(state.connection.webhookUrl)}</b></div>
    </div>
    <p class="hint">Scopes: ${esc(state.connection.scopes.join(", "))}. Push tokens ${state.connection.pushEnabled ? "on" : "off"}. Token handover is for the bank IT team. Super admin can rotate it.</p>
    <div class="mono">POST ${esc(state.connection.apiBase)}/escrow/lock
Idempotency-Key required
HMAC-SHA256 on the body with the sandbox webhook secret
A repeated reference is rejected. A bad signature does not move the GL.</div>
    <div style="height:8px"></div>
    <button class="btn" id="test-link">Test handshake</button>
    ${user.role === "SUPER" ? `<button class="btn-ghost" id="rotate-token">Rotate token</button>` : ""}
    <div class="field" style="margin-top:12px"><label>Webhook URL the bank receives</label><input id="wh-url" value="${esc(state.connection.webhookUrl)}"></div>
    <button class="btn-ghost" id="save-wh">Save webhook URL</button>`;
}
function bankTraining() {
  return `<h2>Frontline guide</h2>
    <div class="card"><b>This is not a personal loan</b><p class="hint">The GH₵ ${cfg().principal} never reaches the customer's hand. It is locked in the escrow sub-ledger. They pay ${money(outOfPocket())} from MoMo. We sweep ${money(cfg().bankSweep)} and report ${money(cfg().monthlyDue)} to XDS.</p></div>
    <div class="card"><b>Failed pull</b><p class="hint">Code 402 means the wallet was short. Grace is 15 days. The file is not late yet. Tell them to fund MoMo. Do not promise a score increase.</p></div>
    <div class="card"><b>Webhook dispute</b><p class="hint">If they were debited and the box did not move, check reconcile. Code 502 is a timeout. Do not post the sweep twice. Duplicate reference is rejected.</p></div>
    <div class="card"><b>Day 16</b><p class="hint">Box breaks. Drops already made go back to MoMo. They owe nothing. Closure is reported, not a debt.</p></div>
    <div class="card"><b>Push copy</b><p class="hint">"Your monthly GH₵ ${cfg().customerShare} contribution failed. Your account is in a 15-day grace period. Please fund your wallet to protect your credit file."</p></div>`;
}
function bankReconcile() {
  return `<h2>Core reconcile</h2>
    <p class="hint">Use this when the telco debited and the sub-ledger did not sweep. It forces the internal GH₵ ${cfg().bankSweep} sweep only if the customer drop is already in the ledger.</p>
    ${state.anomalies.map(function (a) {
      return `<div class="card"><b>${esc(a.code)}</b> <span class="badge ${a.status === "OPEN" ? "b-warn" : "b-ok"}">${esc(a.status)}</span><p class="hint">${esc(a.detail)} · ${esc(a.loanHint)}</p>${a.status === "OPEN" ? `<button class="btn" data-reconcile="${a.id}">Force sweep</button>` : ""}</div>`;
    }).join("")}`;
}
function bankAudit() {
  return `<h2>Bank-visible audit</h2><table><tr><th>When</th><th>Actor</th><th>Action</th></tr>${state.audit.slice(0, 20).map(function (a) { return `<tr><td>${esc(a.at)}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td></tr>`; }).join("")}</table>`;
}
function bindBank() {
  document.querySelectorAll("[data-bank]").forEach(function (el) {
    el.onclick = function () { state.bankView = el.dataset.bank; state.flash = ""; render(); };
  });
  document.querySelectorAll("[data-jump]").forEach(function (el) {
    el.onclick = function () { state.forceBank = false; jump(el.dataset.jump); };
  });
  document.querySelectorAll("[data-logout]").forEach(function (el) {
    el.onclick = function () { state.session = null; state.forceBank = false; state.view = "welcome"; flash("Logged out."); render(); };
  });
  const leave = document.getElementById("leave-bank");
  if (leave) leave.onclick = function () { state.forceBank = false; state.adminView = "command"; render(); };
  const add = document.getElementById("add-bank-user");
  if (add) add.onclick = function () {
    const name = document.getElementById("bu-name").value.trim();
    const username = document.getElementById("bu-user").value.trim();
    const pin = document.getElementById("bu-pin").value.trim();
    const role = document.getElementById("bu-role").value;
    if (name.length < 3 || !username || !/^\d{4}$/.test(pin)) return fail("Name, username, and 4-digit PIN are required."), render();
    if (state.users.some(function (u) { return u.username === username; })) return fail("Username already used."), render();
    state.users.push({ id: uid("usr"), role: role, pin: pin, username: username, name: name, phone: "", ghanaCard: "", provider: "", momo: "", score: null, consents: {}, wallet: 0, createdAt: todayISO(0), channel: "BANK_PORTAL", active: true });
    audit("Bank user created: " + username + " " + role);
    flash("Login created.");
    render();
  };
  document.querySelectorAll("[data-suspend]").forEach(function (el) {
    el.onclick = function () {
      const u = state.users.find(function (x) { return x.id === el.dataset.suspend; });
      u.active = u.active === false;
      audit((u.active ? "Restored " : "Suspended ") + u.username);
      flash(u.name + (u.active ? " restored." : " suspended."));
      render();
    };
  });
  document.querySelectorAll("[data-bank-setoff]").forEach(function (el) {
    el.onclick = function () {
      const loan = state.loans.find(function (l) { return l.id === el.dataset.bankSetoff; });
      setOff(loan, "Bank core confirm");
      loan.corePosted = true;
      flash("Set-off posted to the core sub-ledger. Customer owes nothing.");
      render();
    };
  });
  document.querySelectorAll("[data-fund]").forEach(function (el) {
    el.onclick = function () {
      const loan = state.loans.find(function (l) { return l.id === el.dataset.fund; });
      loan.offerStatus = "FUNDED_ON_CORE";
      audit("Graduation line marked funded for " + loan.id);
      flash("Line marked funded on the core. Still not the builder book.");
      render();
    };
  });
  const test = document.getElementById("test-link");
  if (test) test.onclick = function () {
    state.connection.status = "SANDBOX_CONNECTED";
    state.connection.lastSync = todayISO(0);
    audit("Core handshake succeeded");
    flash("Handshake ok. Escrow GL answered.");
    render();
  };
  const rotate = document.getElementById("rotate-token");
  if (rotate) rotate.onclick = function () {
    state.connection.clientSecret = "sbx_" + Math.random().toString(36).slice(2, 10);
    audit("API token rotated");
    flash("Token rotated. Hand the new value to bank IT.");
    render();
  };
  const saveWh = document.getElementById("save-wh");
  if (saveWh) saveWh.onclick = function () {
    state.connection.webhookUrl = document.getElementById("wh-url").value.trim();
    audit("Bank webhook URL updated");
    flash("Webhook URL saved.");
    render();
  };
  document.querySelectorAll("[data-reconcile]").forEach(function (el) {
    el.onclick = function () {
      const a = state.anomalies.find(function (x) { return x.id === el.dataset.reconcile; });
      a.status = "SWEPT";
      state.connection.lastSync = todayISO(0);
      audit("Manual reconcile forced escrow sweep");
      flash("Sweep forced. Duplicate post blocked by reference.");
      render();
    };
  });
  const exp = document.getElementById("bank-export");
  if (exp) exp.onclick = exportCsv;
}
const _jumpBank = jump;
jump = function (role) {
  if (role === "bank") {
    const user = state.users.find(function (u) { return u.username === "bank.admin"; });
    state.session = user.id;
    state.forceBank = false;
    state.bankView = "home";
    state.flash = "";
    render();
    return;
  }
  state.forceBank = false;
  _jumpBank(role);
};
const _renderBank = render;
render = function () {
  ensureBank();
  const user = sessionUser();
  if (user && user.active === false) {
    state.session = null;
    fail("This login is suspended.");
  }
  const current = sessionUser();
  if (current && (isBank(current) || (current.role === "SUPER" && state.forceBank))) {
    document.getElementById("app").innerHTML = bankPage(current);
    bindBank();
    save();
    return;
  }
  _renderBank();
  const bar = document.querySelector(".demo-switch");
  if (bar && !bar.querySelector("[data-jump='bank']")) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = "Bank";
    b.setAttribute("data-jump", "bank");
    b.onclick = function () { jump("bank"); };
    bar.insertBefore(b, bar.lastElementChild);
  }
};
const _login = loginView;
loginView = function () {
  return _login().replace(
    "Help desk help.desk / 1357.",
    "Help desk help.desk / 1357. Bank portal bank.admin / 1111, treasury.osei / 2222, risk.mensah / 3333, credit.owusu / 4444."
  );
};
const _adminShellBank = adminShell;
adminShell = function (user) {
  return _adminShellBank(user).replace(
    '<button class="btn-ghost btn-block" data-logout="1">Log out</button>',
    '<button class="chip" id="open-bank">Bank portal</button><button class="chip" data-admin="everything">Everything</button><button class="btn-ghost btn-block" data-logout="1">Log out</button>'
  );
};
const _adminViewBank = adminView;
adminView = function (user) {
  if (state.adminView === "everything") return everythingView(user);
  return _adminViewBank(user);
};
function everythingView(user) {
  if (user.role !== "SUPER") return `<h2>Super admin only</h2>`;
  return `<h2>Everything</h2>
    <p class="hint">Customers, MCB staff, bank desks, connection, sandbox, anomalies. Nothing on this book is hidden from super admin.</p>
    <div class="kpi-grid">
      <div class="stat"><span>People</span><b>${state.users.length}</b></div>
      <div class="stat"><span>Bank logins</span><b>${state.users.filter(function (u) { return String(u.role).indexOf("BANK_") === 0; }).length}</b></div>
      <div class="stat"><span>Locked</span><b>${money(lockedTotal())}</b></div>
      <div class="stat"><span>Open anomalies</span><b>${state.anomalies.filter(function (a) { return a.status === "OPEN"; }).length}</b></div>
    </div>
    <table><tr><th>Name</th><th>Role</th><th>Login</th><th></th></tr>
    ${state.users.map(function (u) {
      return `<tr><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(u.username || u.phone)}</td><td>${u.role === "CUSTOMER" ? `<button class="chip" data-impersonate="${u.id}">Open box</button>` : ""}</td></tr>`;
    }).join("")}</table>
    <div style="height:8px"></div>
    <button class="btn" id="open-bank-2">Open the bank portal as super admin</button>
    <p class="hint">Connection ${esc(state.connection.status)} · token ends ${esc(state.connection.clientSecret.slice(-4))} · webhook ${esc(state.connection.webhookUrl)}</p>`;
}
const _bindBank = bind;
bind = function () {
  _bindBank();
  const open = document.getElementById("open-bank") || document.getElementById("open-bank-2");
  document.querySelectorAll("#open-bank, #open-bank-2").forEach(function (el) {
    el.onclick = function () { state.forceBank = true; state.bankView = "home"; render(); };
  });
};
render();
