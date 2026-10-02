const GHANA_BANKS = ["GCB Bank", "Ecobank Ghana", "Absa Bank Ghana", "Stanbic Bank", "Fidelity Bank", "CalBank", "Access Bank", "Zenith Bank", "ADB", "Republic Bank", "Societe Generale", "UMB"];

const SEC_ITEMS = [
  ["customerYieldLanguage", "Customer yield language", "Words like earn, return, or profit on the susu box. This product is a credit-builder, not an investment."],
  ["tbillCustomerOffer", "Treasury bills for customers", "Letting a customer buy or roll Bank of Ghana bills inside the app."],
  ["securitiesCrossSell", "Securities cross-sell", "Shares, mutual funds, or other Securities and Exchange Commission products after graduation."],
  ["groupInvestmentReturn", "Group pool as an investment", "Stating a return on a group susu pool. Covering a missed drop stays available either way."],
  ["publicFloatMarketing", "Show float yield to customers", "Telling customers what the locked escrow earns in the bank treasury book."],
  ["guaranteedReturnCopy", "Guaranteed return copy", "Any line that promises a profit or a guaranteed gain."]
];

const PERM_KEYS = ["command", "customers", "loans", "collections", "bureau", "webhooks", "desk", "faq", "groups", "audit", "billing", "config", "roles", "sandbox", "engine", "schema", "tests", "runbook", "everything", "permissions", "sec", "home", "training", "treasury", "setoff", "reconcile", "credit", "users", "connect", "accounts"];

function defaultPerms() {
  return {
    SUPPORT: ["command", "customers", "desk", "faq", "runbook"],
    OPS: ["command", "customers", "loans", "collections", "bureau", "webhooks", "desk", "faq", "groups", "audit", "billing", "sandbox", "runbook"],
    SUPER: ["*"],
    BANK_ADMIN: ["home", "customers", "training", "users", "connect", "audit", "treasury", "setoff", "reconcile", "credit", "accounts"],
    TREASURY: ["home", "customers", "training", "treasury"],
    RISK: ["home", "customers", "training", "setoff", "reconcile", "accounts"],
    CREDIT: ["home", "customers", "training", "credit"]
  };
}
function defaultSec() {
  const sec = { registered: false };
  SEC_ITEMS.forEach(function (item) { sec[item[0]] = false; });
  return sec;
}
function ensureAccess() {
  if (!state.permissions) state.permissions = defaultPerms();
  PERM_KEYS.concat(["*"]).forEach(function () {});
  Object.keys(defaultPerms()).forEach(function (role) {
    if (!state.permissions[role]) state.permissions[role] = defaultPerms()[role];
  });
  if (!state.sec) state.sec = defaultSec();
  SEC_ITEMS.forEach(function (item) { if (state.sec[item[0]] == null) state.sec[item[0]] = false; });
  state.users.forEach(function (u) {
    if (u.role !== "CUSTOMER") return;
    if (!u.bankAccounts) u.bankAccounts = [];
    if (!u.repayFrom) u.repayFrom = "MOMO";
  });
  const ama = state.users.find(function (u) { return u.phone === "0244111001"; });
  if (ama && ama.bankAccounts.length === 0) {
    ama.bankAccounts.push({ id: "ba-ama", bank: "GCB Bank", number: "1234567890123", name: ama.name, branch: "Makola", status: "LINKED", at: todayISO(-20) });
  }
}
function secOn(key) { return !!(state.sec && state.sec[key]); }
function secAny() { return SEC_ITEMS.some(function (item) { return secOn(item[0]); }); }
function canDo(user, key) {
  if (!user) return false;
  if (user.role === "SUPER") return true;
  const list = (state.permissions && state.permissions[user.role]) || [];
  return list.indexOf("*") >= 0 || list.indexOf(key) >= 0;
}
function maskNum(n, full) {
  const s = String(n || "");
  if (full) return s;
  return "···· " + s.slice(-4);
}
function linkedAccount(user) {
  return (user.bankAccounts || []).find(function (a) { return a.status === "LINKED"; }) || null;
}

function accountsView(user) {
  const rows = user.bankAccounts || [];
  return `${banners()}<p class="kicker">GhIPSS</p><h2>Bank account</h2>
    <p class="hint">Link a Ghana bank account as another way to pay the GH₵ drop. Name enquiry runs against the name on this box. This is a payment rail, not an investment account.</p>
    ${rows.map(function (a) {
      return `<div class="row-card"><div><b>${esc(a.bank)}</b><div class="small muted">${esc(maskNum(a.number, false))} · ${esc(a.branch)} · ${esc(a.name)}</div></div><span class="badge ${a.status === "LINKED" ? "b-ok" : "b-warn"}">${esc(a.status)}</span></div>`;
    }).join("") || `<p class="hint">No account linked yet.</p>`}
    <div class="field" style="margin-top:12px"><label>Bank</label><select id="bk-bank">${GHANA_BANKS.map(function (b) { return `<option>${esc(b)}</option>`; }).join("")}</select></div>
    <div class="field"><label>Account number</label><input id="bk-num" inputmode="numeric" placeholder="13 digits"></div>
    <div class="field"><label>Account name</label><input id="bk-name" value="${esc(user.name)}"></div>
    <div class="field"><label>Branch</label><input id="bk-branch" placeholder="Makola"></div>
    <button class="btn btn-block" id="link-bank">Link account</button>
    ${linkedAccount(user) ? `<div style="height:8px"></div><button class="btn-ghost btn-block" id="use-bank">Use linked account for the monthly drop</button>` : ""}
    <p class="footer-note">Repayment rail now: ${esc(user.repayFrom || "MOMO")}.</p>`;
}
function investmentsView() {
  if (!secAny()) {
    return `${banners()}<p class="kicker">Not offered</p><h2>No securities in this app</h2>
      <p class="hint">Digital Susu is registered through the partner bank in Ghana. It is not registered with the Securities and Exchange Commission, and it does not sell bills, shares, or funds. Super admin has those activities switched off.</p>`;
  }
  return `${banners()}<p class="kicker">Switched on by super admin</p><h2>Extra products</h2>
    ${secOn("tbillCustomerOffer") ? `<div class="card"><b>91-day bill</b><p class="hint">A customer treasury-bill offer is on. This is an SEC-sensitive activity.</p></div>` : ""}
    ${secOn("securitiesCrossSell") ? `<div class="card"><b>Funds and shares</b><p class="hint">Graduation cross-sell into securities is on.</p></div>` : ""}
    ${secOn("customerYieldLanguage") || secOn("publicFloatMarketing") || secOn("guaranteedReturnCopy") ? `<div class="notice">Yield or guaranteed-return language is visible because a super admin turned it on.</div>` : ""}
    ${secOn("groupInvestmentReturn") ? `<div class="card"><b>Group pool return</b><p class="hint">Group susu is being described as an investment return.</p></div>` : ""}`;
}
function permissionsView(user) {
  if (user.role !== "SUPER") return `<h2>Super admin only</h2>`;
  const roles = Object.keys(state.permissions);
  return `<h2>User permissions</h2>
    <p class="hint">Super admin always sees everything. Other desks only see what is ticked. Bank logins use the same matrix.</p>
    ${roles.map(function (role) {
      const list = state.permissions[role];
      const star = list.indexOf("*") >= 0;
      return `<div class="card"><b>${esc(role)}</b>${star ? `<p class="hint">Full access.</p>` : `<div class="perm-grid">${PERM_KEYS.map(function (key) {
        return `<label class="check"><input type="checkbox" data-perm="${esc(role)}:${esc(key)}" ${list.indexOf(key) >= 0 ? "checked" : ""}><span>${esc(key)}</span></label>`;
      }).join("")}</div>`}</div>`;
    }).join("")}
    <button class="btn" id="save-perms">Save permissions</button>`;
}
function secView(user) {
  if (user.role !== "SUPER") return `<h2>Super admin only</h2>`;
  return `<h2>Securities and Exchange Commission</h2>
    <div class="notice">The firm is registering in Ghana with the partner bank. It is not registering with the Securities and Exchange Commission for now. Anything below can look like a securities business. Leave it off until counsel clears it.</div>
    <label class="toggle"><input type="checkbox" id="sec-reg" ${state.sec.registered ? "checked" : ""}><span>SEC registration is in force. Required before any switch below can stay on in a live book.</span></label>
    ${SEC_ITEMS.map(function (item) {
      return `<label class="toggle"><input type="checkbox" data-sec="${item[0]}" ${secOn(item[0]) ? "checked" : ""}><span><b>${esc(item[1])}</b><br>${esc(item[2])}</span></label>`;
    }).join("")}
    <button class="btn" id="save-sec">Save securities switches</button>`;
}
function bankAccountsAdmin(actor) {
  const full = canDo(actor, "accounts") && (actor.role === "SUPER" || actor.role === "BANK_ADMIN" || actor.role === "RISK");
  const rows = [];
  state.users.filter(function (u) { return u.role === "CUSTOMER"; }).forEach(function (u) {
    (u.bankAccounts || []).forEach(function (a) { rows.push({ u: u, a: a }); });
  });
  return `<h2>Linked bank accounts</h2>
    <p class="hint">GhIPSS name enquiry. Pending rows need a bank or super admin confirm. Numbers are masked unless your desk has account detail.</p>
    <table><tr><th>Customer</th><th>Bank</th><th>Number</th><th>Name</th><th>Status</th><th></th></tr>
    ${rows.map(function (row) {
      return `<tr><td>${esc(row.u.name)}</td><td>${esc(row.a.bank)}</td><td>${esc(maskNum(row.a.number, full))}</td><td>${esc(row.a.name)}</td><td>${esc(row.a.status)}</td><td>${row.a.status !== "LINKED" ? `<button class="chip" data-verify="${row.a.id}">Verify</button>` : ""}</td></tr>`;
    }).join("") || `<tr><td colspan="6">No linked accounts.</td></tr>`}</table>`;
}

ensureAccess();

bankCan = function (user, area) {
  if (!user) return false;
  if (user.role === "SUPER") return true;
  return canDo(user, area);
};

const _bankPageAccess = bankPage;
bankPage = function (user) {
  const viewing = user.role === "SUPER";
  const items = [["home", "Portfolio"], ["customers", "Customers"], ["training", "Staff guide"]];
  if (bankCan(user, "accounts")) items.splice(2, 0, ["accounts", "Linked accounts"]);
  ["treasury", "setoff", "reconcile", "credit", "users", "connect", "audit"].forEach(function (key) {
    if (bankCan(user, key)) {
      const labels = { treasury: "Treasury", setoff: "Set-off", reconcile: "Reconcile", credit: "Graduation", users: "Users", connect: "Connection", audit: "Audit" };
      items.push([key, labels[key]]);
    }
  });
  if (!items.some(function (it) { return it[0] === state.bankView; })) state.bankView = "home";
  return `<div class="portal">
    <div class="portal-frame">
      <aside class="portal-side">
        <div class="portal-brand"><div class="mark"><span>₵</span></div><div><strong>${esc(cfg().bankName)}</strong><span>Core portal</span></div></div>
        ${items.map(function (it) { return `<button class="nav-item ${state.bankView === it[0] ? "on" : ""}" data-bank="${it[0]}">${it[1]}</button>`; }).join("")}
        <div class="side-foot">${esc(state.connection.core)}<br>${esc(state.connection.escrowGl)}</div>
      </aside>
      <section class="portal-main">
        <div class="portal-top">
          <div><span class="env-pill">${esc(state.connection.status)}</span></div>
          <div class="demo-switch">
            <span>${esc(user.name)} · ${esc(user.role.replace("BANK_", ""))}</span>
            <button class="chip" data-jump="customer">Customer</button>
            <button class="chip" data-jump="super">Super admin</button>
            ${viewing ? `<button class="btn-ghost" id="leave-bank">MCB console</button>` : `<button class="btn-ghost" data-logout="1">Sign out</button>`}
          </div>
        </div>
        ${viewing ? `<div class="notice">Signed in as super admin. Every desk, user, and token is visible.</div>` : ""}
        ${banners()}
        <div class="wide">${bankBody(user)}</div>
      </section>
    </div>
  </div>`;
};

const _bankBodyAccess = bankBody;
bankBody = function (user) {
  if (state.bankView === "accounts") return bankAccountsAdmin(user);
  return _bankBodyAccess(user);
};

const _treasury = bankTreasury;
bankTreasury = function () {
  let html = _treasury();
  if (!secOn("tbillCustomerOffer") && !secOn("publicFloatMarketing")) {
    html = html.replace(/Map this residual[\s\S]*?<\/p>/, `<p class="hint">Internal escrow balance only. Customers are not offered bills or a yield. Those switches are off while the firm is outside SEC registration.</p>`);
  }
  return html;
};

const _customerViewAccess = customerView;
customerView = function (user) {
  if (state.view === "accounts") return accountsView(user);
  if (state.view === "investments") return investmentsView();
  return _customerViewAccess(user);
};

const _moreAccess = moreView;
moreView = function (user) {
  return _moreAccess(user).replace(
    '<button class="row-card" data-go="profile"><b>Profile &amp; consents</b><span>›</span></button>',
    '<button class="row-card" data-go="profile"><b>Profile &amp; consents</b><span>›</span></button><button class="row-card" data-go="accounts"><b>Link a bank account</b><span>›</span></button><button class="row-card" data-go="investments"><b>Securities</b><span>›</span></button>'
  );
};

const _homeAccess = homeView;
homeView = function (user, loan) {
  let html = _homeAccess(user, loan);
  const acct = linkedAccount(user);
  html += acct ? `<p class="footer-note">Drop rail: ${esc(user.repayFrom === "BANK" ? acct.bank + " " + maskNum(acct.number, false) : user.provider + " MoMo")}.</p>` : "";
  if (secOn("publicFloatMarketing") || secOn("customerYieldLanguage")) {
    html += `<div class="notice">Float yield language is on. This is visible only because super admin enabled an SEC-sensitive switch.</div>`;
  }
  return html;
};

const _payAccess = payView;
payView = function (user, loan) {
  const acct = linkedAccount(user);
  const extra = acct ? `<div style="height:8px"></div><button class="btn-ghost btn-block" id="pay-bank">Pay from ${esc(acct.bank)} ${esc(maskNum(acct.number, false))}</button>` : `<p class="hint">No linked bank account yet. Add one under More.</p>`;
  return _payAccess(user, loan) + extra;
};

const _groupAccess = groupView;
groupView = function (user, loan) {
  const html = _groupAccess(user, loan);
  if (secOn("groupInvestmentReturn")) return html + `<div class="notice">Group pool return language is on. That switch is SEC-sensitive.</div>`;
  return html;
};

const _adminViewAccess = adminView;
adminView = function (user) {
  if (state.adminView === "permissions") return permissionsView(user);
  if (state.adminView === "sec") return secView(user);
  if (user.role !== "SUPER" && state.adminView && state.adminView !== "command" && !canDo(user, state.adminView)) {
    return `<h2>Outside your permissions</h2><p class="hint">Super admin controls who can open this desk.</p>`;
  }
  return _adminViewAccess(user);
};

const _adminShellAccess = adminShell;
adminShell = function (user) {
  let html = _adminShellAccess(user).replace(
    '<button class="btn-ghost btn-block" data-logout="1">Log out</button>',
    '<button class="chip" data-admin="permissions">Permissions</button><button class="chip" data-admin="sec">SEC switches</button><button class="btn-ghost btn-block" data-logout="1">Log out</button>'
  );
  if (user.role !== "SUPER") {
    html = html.replace(/<button\b[^>]*data-admin="([^"]+)"[^>]*>[\s\S]*?<\/button>/g, function (full, id) {
      return canDo(user, id) ? full : "";
    });
  }
  return html;
};

const _commandAccess = commandAdmin;
commandAdmin = function () {
  let html = _commandAccess();
  const user = sessionUser();
  if (user && !canDo(user, "billing")) html = html.replace(/<button class="btn" id="run-billing">[\s\S]*?<\/button>/, "");
  return html;
};

const _bindAccess = bind;
bind = function () {
  _bindAccess();
  const link = document.getElementById("link-bank");
  if (link) link.onclick = function () {
    const user = sessionUser();
    const number = document.getElementById("bk-num").value.replace(/\s/g, "");
    const name = document.getElementById("bk-name").value.trim();
    const branch = document.getElementById("bk-branch").value.trim();
    if (!/^\d{10,16}$/.test(number)) return fail("Use the account number from your bank, 10 to 16 digits."), render();
    const last = user.name.split(" ").slice(-1)[0].toLowerCase();
    const matched = name.toLowerCase().indexOf(last) >= 0;
    user.bankAccounts.push({
      id: uid("ba"), bank: document.getElementById("bk-bank").value, number: number, name: name,
      branch: branch || "Main", status: matched ? "LINKED" : "PENDING", at: todayISO(0)
    });
    audit("Bank account link " + (matched ? "matched" : "pending") + " for " + user.name);
    flash(matched ? "Name enquiry matched. Account linked." : "Name did not match. The bank desk will review it.");
    render();
  };
  const useBank = document.getElementById("use-bank");
  if (useBank) useBank.onclick = function () {
    sessionUser().repayFrom = "BANK";
    flash("Monthly drop will be requested from the linked bank account.");
    render();
  };
  const payBank = document.getElementById("pay-bank");
  if (payBank) payBank.onclick = function () {
    const user = sessionUser();
    const loan = loanOf(user.id);
    if (!linkedAccount(user)) return fail("Link an account first."), render();
    const need = typeof outOfPocket === "function" ? outOfPocket() : cfg().customerShare;
    if (user.wallet < need) user.wallet = need;
    postPayment(user, loan, "BANK_GHIPSS");
    render();
  };
  const savePerms = document.getElementById("save-perms");
  if (savePerms) savePerms.onclick = function () {
    Object.keys(state.permissions).forEach(function (role) {
      if (state.permissions[role].indexOf("*") >= 0) return;
      state.permissions[role] = [];
    });
    document.querySelectorAll("[data-perm]").forEach(function (el) {
      if (!el.checked) return;
      const parts = el.dataset.perm.split(":");
      state.permissions[parts[0]].push(parts[1]);
    });
    audit("Permission matrix updated");
    flash("Permissions saved.");
    render();
  };
  const saveSec = document.getElementById("save-sec");
  if (saveSec) saveSec.onclick = function () {
    const registered = document.getElementById("sec-reg").checked;
    let blocked = false;
    SEC_ITEMS.forEach(function (item) {
      const on = document.querySelector('[data-sec="' + item[0] + '"]').checked;
      if (on && !registered) blocked = true;
      state.sec[item[0]] = on && registered;
    });
    state.sec.registered = registered;
    audit("SEC switches updated");
    flash(blocked ? "Switches that need SEC registration stayed off." : "Securities switches saved. Default remains off.");
    render();
  };
  document.querySelectorAll("[data-verify]").forEach(function (el) {
    el.onclick = function () {
      state.users.forEach(function (u) {
        (u.bankAccounts || []).forEach(function (a) {
          if (a.id === el.dataset.verify) a.status = "LINKED";
        });
      });
      audit("Bank account verified");
      flash("Account verified and linked.");
      render();
    };
  });
};

render();
