const STORAGE_KEY = "mcb-digital-susu-v1";

const DEFAULT_CONFIG = {
  productName: "Digital Susu",
  bankName: "Amanfo Savings & Loans",
  ussdCode: "*385#",
  principal: 600,
  monthlyDue: 50,
  customerShare: 5,
  bankSweep: 45,
  setupFee: 15,
  ledgerFee: 1,
  termMonths: 12,
  graceDays: 15,
  platinumLimit: 2500,
  goldPreviewLimit: 500,
  silverMonth: 3,
  goldMonth: 6,
  signupOpen: true,
  sandbox: true,
  providers: { MTN: true, Telecel: true, "AT Money": true },
  features: { groupSusu: true, ussd: true, metadataScan: true, smeLine: true },
  scoreFloor: 40,
  supportPhone: "0302 610 385",
  webhookSecret: "mcb_sandbox_hmac_2026",
  discounts: { BRONZE: 0, SILVER: 0.5, GOLD: 1, PLATINUM: 2 }
};

const FAQ = [
  ["Q1", "What is Digital Susu?", "It is a safe, digital way to build an official bank credit score while you save. The bank sets up a locked GH₵ 600 Credit Box in your name. Every month you make a tiny contribution from your phone, the bank tops it up, and a perfect on-time repayment history is sent to XDS Data Ghana so you can unlock larger business loans."],
  ["Q2", "Do I need a payslip, collateral, or an accountant?", "No. This program is for informal traders, youth, and market business owners. You only need a valid Ghana Card and an active Mobile Money account (MTN MoMo, Telecel Cash, or AT Money). A 5-second phone behavior scan approves you. No payslip, no collateral, no branch visit."],
  ["Q3", "How much do I pay out of pocket every month?", "You pay GH₵ 5 a month from your Mobile Money wallet. Each time you drop GH₵ 5, the bank sweeps GH₵ 45 from the locked Credit Box and reports a full GH₵ 50 on-time payment to the bureau."],
  ["Q4", "Are there activation or setup fees?", "Yes. A one-time activation fee of GH₵ 15 is deducted when you open the box. A GH₵ 1 monthly ledger fee is included inside your monthly commitment. Your GH₵ 5 still counts toward the GH₵ 60 savings reward."],
  ["Q5", "What happens to my money after 12 months?", "You break the Susu box and take your cash back. The bank unlocks the GH₵ 60 you personally saved (12 × GH₵ 5) and drops it into your wallet. The locked GH₵ 600 was the bank's collateral and is retired with the loan. You never owed that principal."],
  ["Q6", "What loans can I get after graduating?", "A clean 12-month record unlocks a pre-approved, non-collateralized GH₵ 2,500 micro-SME working-capital line, or phone financing, from the partner bank. Earlier tiers preview smaller limits. The bank funds the line. This app originates it."],
  ["Q7", "What if market is slow and I miss my GH₵ 5?", "This is a zero debt-trap program. If your wallet is empty on the due date, the app opens a 15-day grace period and does not report a late payment yet. If you still cannot fund it by day 16, the system breaks the box with the locked collateral, clears the ledger to zero, refunds any personal drops already made, and closes the loan. You will not owe the bank a pesewa, and there is no penalty fee. The closure is reported."],
  ["Q8", "Does the app read my WhatsApp, passwords, or photos?", "No. Under the Data Protection Act, 2012 (Act 843), the metadata scan only looks at anonymized device signals such as storage hygiene, system stability, and charging cycles. Messages, contacts, passwords, and gallery stay untouched. You can withdraw consent in Profile. Withdrawing consent stops new bureau updates and new scans."]
];

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}
function money(n) {
  const v = Number(n || 0);
  return "GH₵ " + v.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, function (c) {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}
function todayISO(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.toISOString().slice(0, 10);
}
function addMonths(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
function tierFor(months, status) {
  if (status === "MATURED_SUCCESS" || months >= 12) return "PLATINUM";
  if (months >= 6) return "GOLD";
  if (months >= 3) return "SILVER";
  return "BRONZE";
}
function limitFor(tier, cfg) {
  if (tier === "PLATINUM") return cfg.platinumLimit;
  if (tier === "GOLD") return cfg.goldPreviewLimit;
  return 0;
}

function seed() {
  const cfg = structuredClone(DEFAULT_CONFIG);
  const users = [
    staff("ops.adjei", "2468", "Adjei Mensima", "OPS", "0244001001"),
    staff("super.admin", "9090", "Esi Quaye", "SUPER", "0244001002"),
    staff("help.desk", "1357", "Nana Yaa", "SUPPORT", "0244001003")
  ];
  const loans = [];
  const ledger = [];
  const bureau = [];
  const notes = [];
  const groups = [{
    id: "grp-makola", name: "Makola Tomatoes", code: "MAKOLA",
    pool: 20, memberIds: [], createdAt: todayISO(-40)
  }];
  function addCustomer(partial, loanPartial) {
    const user = {
      id: uid("usr"),
      role: "CUSTOMER",
      pin: "1234",
      name: partial.name,
      phone: partial.phone,
      ghanaCard: partial.ghanaCard,
      provider: partial.provider,
      momo: partial.phone,
      score: partial.score,
      consents: { scan: true, bureau: true, terms: true },
      wallet: partial.wallet,
      createdAt: partial.createdAt,
      channel: partial.channel || "NATIVE_APP"
    };
    users.push(user);
    const months = loanPartial.months;
    const status = loanPartial.status;
    const tier = tierFor(months, status);
    const loan = {
      id: uid("loan"),
      userId: user.id,
      principal: cfg.principal,
      locked: loanPartial.locked,
      contributed: loanPartial.contributed,
      months,
      maxMonths: 12,
      status,
      tier,
      limit: status === "MATURED_SUCCESS" ? cfg.platinumLimit : limitFor(tier, cfg),
      discount: cfg.discounts[tier],
      nextDue: loanPartial.nextDue,
      graceStart: loanPartial.graceStart || null,
      openedAt: partial.createdAt,
      groupId: loanPartial.groupId || null,
      offerStatus: status === "MATURED_SUCCESS" ? "AVAILABLE" : "LOCKED"
    };
    loans.push(loan);
    if (loan.groupId) groups[0].memberIds.push(user.id);
    for (let i = 0; i < months; i++) {
      ledger.push({
        id: uid("tx"), loanId: loan.id, userId: user.id, amount: 5, fee: 1, sweep: 45,
        type: "CO_PAYMENT", channel: user.provider === "MTN" ? "MTN_MOMO_API" : "INTERNAL_APP",
        status: "SUCCESS", date: addMonths(partial.createdAt, i + 1), ref: "SEED-" + loan.id.slice(-4) + "-" + (i + 1)
      });
      bureau.push({
        id: uid("bur"), loanId: loan.id, userId: user.id, month: i + 1,
        amount: 50, status: "REPORTED", bureau: "XDS Data Ghana", date: addMonths(partial.createdAt, i + 1)
      });
    }
    return user;
  }
  addCustomer({
    name: "Ama Serwaa", phone: "0244111001", ghanaCard: "GHA-100200300-1", provider: "MTN",
    score: 72, wallet: 86.4, createdAt: todayISO(-70)
  }, { months: 2, status: "ACTIVE", locked: 510, contributed: 10, nextDue: todayISO(6) });
  addCustomer({
    name: "Kwame Mensah", phone: "0204222002", ghanaCard: "GHA-200300400-2", provider: "Telecel",
    score: 81, wallet: 40, createdAt: todayISO(-130)
  }, { months: 4, status: "ACTIVE", locked: 420, contributed: 20, nextDue: todayISO(2) });
  addCustomer({
    name: "Efua Boateng", phone: "0274333003", ghanaCard: "GHA-300400500-3", provider: "AT Money",
    score: 88, wallet: 120, createdAt: todayISO(-200), channel: "USSD_385"
  }, { months: 7, status: "ACTIVE", locked: 285, contributed: 35, nextDue: todayISO(12), groupId: "grp-makola" });
  const graceUser = addCustomer({
    name: "Kofi Asante", phone: "0244444004", ghanaCard: "GHA-400500600-4", provider: "MTN",
    score: 61, wallet: 1.2, createdAt: todayISO(-100)
  }, { months: 3, status: "GRACE", locked: 465, contributed: 15, nextDue: todayISO(-8), graceStart: todayISO(-8), groupId: "grp-makola" });
  addCustomer({
    name: "Abena Owusu", phone: "0504555005", ghanaCard: "GHA-500600700-5", provider: "Telecel",
    score: 54, wallet: 22, createdAt: todayISO(-160)
  }, { months: 2, status: "DEFAULT_CLOSED", locked: 0, contributed: 0, nextDue: null });
  addCustomer({
    name: "Yaw Darko", phone: "0244666006", ghanaCard: "GHA-600700800-6", provider: "MTN",
    score: 93, wallet: 210, createdAt: todayISO(-380)
  }, { months: 12, status: "MATURED_SUCCESS", locked: 0, contributed: 60, nextDue: null });
  const tickets = [
    { id: uid("tkt"), userId: graceUser.id, topic: "Missed drop", body: "Market was slow. Can I still pay inside grace?", status: "TIER1", tier: 1, createdAt: todayISO(-1), replies: [{ by: "Nana Yaa", text: "Yes. Fund GH₵ 5 before day 16 and we report the month on time.", at: todayISO(0) }] }
  ];
  const audit = [{ id: uid("aud"), at: todayISO(0), actor: "system", action: "Sandbox ledger seeded" }];
  const webhooks = [{ id: uid("wh"), at: todayISO(-1), provider: "MTN", status: "SUCCESS", ref: "MOMO-88421", amount: 5, verified: true }];
  const faqClicks = [
    { id: uid("faq"), key: "Q7", channel: "USSD_385", tier: "BRONZE", at: todayISO(-2) },
    { id: uid("faq"), key: "Q7", channel: "NATIVE_APP", tier: "SILVER", at: todayISO(-1) },
    { id: uid("faq"), key: "Q3", channel: "NATIVE_APP", tier: "BRONZE", at: todayISO(-3) },
    { id: uid("faq"), key: "Q8", channel: "NATIVE_APP", tier: "GOLD", at: todayISO(-4) }
  ];
  return {
    config: cfg, users, loans, ledger, bureau, tickets, groups, audit, webhooks, faqClicks, notes,
    notifications: [
      { id: uid("nt"), userId: users.find(u => u.name === "Ama Serwaa").id, text: "Next Susu drop of GH₵ 5 is due soon. Keep it in MoMo.", read: false, at: todayISO(0) }
    ],
    session: null,
    view: "welcome",
    signup: {},
    ussd: { screen: "home", input: "" },
    adminView: "command",
    flash: "",
    error: ""
  };
}
function staff(username, pin, name, role, phone) {
  return { id: uid("usr"), role, pin, username, name, phone, ghanaCard: "", provider: "", momo: phone, score: null, consents: {}, wallet: 0, createdAt: todayISO(-20), channel: "CONSOLE" };
}

let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return seed();
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function resetDemo() { state = seed(); save(); render(); }

function cfg() { return state.config; }
function sessionUser() { return state.users.find(u => u.id === state.session) || null; }
function loanOf(userId) { return state.loans.find(l => l.userId === userId) || null; }
function audit(action) {
  const actor = sessionUser();
  state.audit.unshift({ id: uid("aud"), at: new Date().toISOString(), actor: actor ? actor.name : "system", action });
}
function notify(userId, text) {
  state.notifications.unshift({ id: uid("nt"), userId, text, read: false, at: todayISO(0) });
}
function flash(msg) { state.flash = msg; state.error = ""; }
function fail(msg) { state.error = msg; state.flash = ""; }

function render() {
  const root = document.getElementById("app");
  const user = sessionUser();
  const admin = user && user.role !== "CUSTOMER";
  root.innerHTML = `
    <div class="app-shell">
      <div class="topbar">
        <div class="brand">
          <div class="mark"><span>₵</span></div>
          <div>
            <h1>${esc(cfg().productName)}</h1>
            <p>${esc(cfg().bankName)} · credit box, not a cash loan</p>
          </div>
        </div>
        <div class="demo-switch">
          <span>Open as</span>
          <button class="chip ${user && user.role === "CUSTOMER" ? "on" : ""}" data-jump="customer">Customer</button>
          <button class="chip ${user && user.role === "SUPPORT" ? "on" : ""}" data-jump="support">Help desk</button>
          <button class="chip ${user && user.role === "OPS" ? "on" : ""}" data-jump="ops">Ops admin</button>
          <button class="chip ${user && user.role === "SUPER" ? "on" : ""}" data-jump="super">Super admin</button>
          <button class="chip" data-reset="1">Reset demo</button>
        </div>
      </div>
      ${admin ? adminShell(user) : customerShell(user)}
    </div>`;
  bind();
  save();
}

function customerShell(user) {
  if (!user) {
    return `<div class="layout solo"><section class="phone">${publicView()}</section></div>`;
  }
  return `<div class="layout">
    <aside class="side">
      <p class="kicker">Signed in</p>
      <h3>${esc(user.name)}</h3>
      <p>${esc(user.provider || "No wallet")} · ${esc(user.phone)}</p>
      <p>Wallet ${money(user.wallet)} · score ${user.score ?? "—"}</p>
      <button class="btn-ghost btn-block" data-go="profile">Profile & consents</button>
      <div style="height:8px"></div>
      <button class="btn-ghost btn-block" data-logout="1">Log out</button>
      <hr class="soft">
      <p class="hint">Sandbox mode is ${cfg().sandbox ? "on" : "off"}. Payments, bureau reports, and set-off run inside this browser.</p>
    </aside>
    <section class="phone">
      <div class="phone-bar"><span>${esc(cfg().bankName)}</span><span>${esc(user.phone)}</span></div>
      <div class="phone-body">${customerView(user)}</div>
      ${bottomNav(state.view)}
    </section>
  </div>`;
}
function bottomNav(view) {
  const items = [["home", "Home"], ["box", "Box"], ["pay", "Pay"], ["help", "Help"], ["more", "More"]];
  return `<div class="nav">${items.map(([id, label]) => `<button class="${view === id ? "on" : ""}" data-go="${id}">${label}</button>`).join("")}</div>`;
}
function banners() {
  return `${state.error ? `<div class="err">${esc(state.error)}</div>` : ""}${state.flash ? `<div class="oknote">${esc(state.flash)}</div>` : ""}`;
}

function publicView() {
  if (state.view === "login") return loginView();
  if (state.view === "signup") return signupView();
  if (state.view === "ussd" && !sessionUser()) return ussdView(null);
  return `<div class="phone-bar"><span>GH</span><span>${esc(cfg().ussdCode)}</span></div>
    <div class="phone-body">
      ${banners()}
      <p class="kicker">${esc(cfg().bankName)}</p>
      <h2>Save small-small. Build a real credit file.</h2>
      <div class="hero-box">
        <div class="small">Locked credit box</div>
        <div style="font-size:32px;font-weight:750;letter-spacing:-.04em">${money(cfg().principal)}</div>
        <p>No payslip. No collateral. No cash in your hand on day one. You drop <strong>${money(cfg().customerShare)}</strong> a month. The bank sweeps <strong>${money(cfg().bankSweep)}</strong> from the box and reports <strong>${money(cfg().monthlyDue)}</strong> on time to XDS.</p>
      </div>
      <div class="grid-2">
        <div class="stat"><span>Out of pocket</span><b>${money(cfg().customerShare)}/mo</b></div>
        <div class="stat"><span>Back at month 12</span><b>${money(cfg().customerShare * cfg().termMonths)}</b></div>
      </div>
      <div style="height:12px"></div>
      <button class="btn btn-block" data-go="signup">Open my Susu box</button>
      <div style="height:8px"></div>
      <button class="btn-ghost btn-block" data-go="login">I already have a box</button>
      <div style="height:8px"></div>
      <button class="btn-ghost btn-block" data-go="ussd">Try USSD ${esc(cfg().ussdCode)}</button>
      <p class="footer-note">Activation fee ${money(cfg().setupFee)} · ledger fee ${money(cfg().ledgerFee)} included in the monthly drop · 15-day grace · zero debt trap.</p>
    </div>`;
}
function loginView() {
  return `<div class="phone-body">${banners()}
    <p class="kicker">Welcome back</p>
    <h2>Open your box</h2>
    <div class="field"><label>Mobile number or staff username</label><input id="login-id" placeholder="0244111001 or super.admin"></div>
    <div class="field"><label>4-digit PIN</label><input id="login-pin" maxlength="4" placeholder="1234"></div>
    <button class="btn btn-block" id="do-login">Log in</button>
    <div style="height:8px"></div>
    <button class="btn-ghost btn-block" data-go="welcome">Back</button>
    <p class="hint">Demo customers use PIN 1234. Ama Serwaa 0244111001 · Kofi Asante (in grace) 0244444004 · Yaw Darko (graduated) 0244666006. Ops  ops.adjei / 2468. Super admin super.admin / 9090. Help desk help.desk / 1357.</p>
  </div>`;
}
function signupView() {
  const s = state.signup;
  const step = s.step || 1;
  const bars = [1, 2, 3, 4, 5].map(n => `<i class="${n <= step ? "on" : ""}"></i>`).join("");
  let body = "";
  if (step === 1) body = `
    <h2>Who is opening the box?</h2>
    <div class="field"><label>Full name</label><input id="su-name" value="${esc(s.name || "")}" placeholder="Ama Serwaa"></div>
    <div class="field"><label>Mobile number</label><input id="su-phone" value="${esc(s.phone || "")}" placeholder="0244XXXXXX"></div>
    <div class="field"><label>Ghana Card</label><input id="su-card" value="${esc(s.ghanaCard || "")}" placeholder="GHA-123456789-0"></div>
    <button class="btn btn-block" id="su-next">Continue</button>`;
  if (step === 2) body = `
    <h2>Protecting your data</h2>
    <p class="hint">Pursuant to the Data Protection Act, 2012 (Act 843). To approve the box without paperwork, we need permission for a 5-second behavioral scan and monthly XDS updates. We never read chats, passwords, or photos.</p>
    <label class="toggle"><input type="checkbox" id="c-scan" ${s.scan ? "checked" : ""}><span>Authorize safe phone behavior scanning to unlock my instant score. Required.</span></label>
    <label class="toggle"><input type="checkbox" id="c-bureau" ${s.bureau ? "checked" : ""}><span>Authorize ${esc(cfg().bankName)} to update my score with XDS Data Ghana every month. Required.</span></label>
    <label class="toggle"><input type="checkbox" id="c-terms" ${s.terms ? "checked" : ""}><span>I understand the GH₵ ${cfg().setupFee} activation fee, the GH₵ ${cfg().customerShare} monthly drop, the locked box, and the 15-day grace then set-off.</span></label>
    <button class="btn btn-block" id="su-scan" ${s.scan && s.bureau && s.terms ? "" : "disabled"}>Agree and scan my phone</button>`;
  if (step === 3) body = `
    <h2>Phone scan</h2>
    <p class="hint">${s.scanning ? "Reading battery cycles, storage hygiene, and system stability. Not your messages." : "Scan complete."}</p>
    <div class="stat"><span>Metadata risk score</span><b>${s.score ?? "…"} / 100</b></div>
    <p class="hint">Approval floor is ${cfg().scoreFloor}. Below that, signup pauses for ops review.</p>
    <button class="btn btn-block" id="su-next" ${s.score == null ? "disabled" : ""}>Continue</button>`;
  if (step === 4) body = `
    <h2>Link your MoMo wallet</h2>
    <p class="hint">Every month the bank pulls a GH₵ ${cfg().customerShare} Susu drop. It tops that up with GH₵ ${cfg().bankSweep} from the locked box and reports GH₵ ${cfg().monthlyDue}.</p>
    <div class="field"><label>Wallet provider</label><select id="su-provider">${Object.keys(cfg().providers).map(p => `<option ${s.provider === p ? "selected" : ""} ${cfg().providers[p] ? "" : "disabled"}>${esc(p)}</option>`).join("")}</select></div>
    <div class="field"><label>MoMo number</label><input id="su-momo" value="${esc(s.momo || s.phone || "")}"></div>
    <div class="notice">Activation fee of ${money(cfg().setupFee)} will be deducted now to open the box.</div>
    <button class="btn btn-block" id="su-next">Continue to PIN</button>`;
  if (step === 5) body = `
    <h2>Set a 4-digit PIN</h2>
    <div class="field"><label>PIN</label><input id="su-pin" maxlength="4" placeholder="1234"></div>
    <div class="field"><label>Confirm PIN</label><input id="su-pin2" maxlength="4"></div>
    <button class="btn btn-block" id="su-finish">Activate my Susu profile · pay ${money(cfg().setupFee)}</button>`;
  return `<div class="phone-body">${banners()}<div class="steps">${bars}</div><p class="kicker">Step ${step} of 5</p>${body}
    <div style="height:8px"></div><button class="btn-ghost btn-block" data-go="welcome">Cancel</button></div>`;
}

function customerView(user) {
  const loan = loanOf(user.id);
  const v = state.view;
  if (v === "box") return boxView(user, loan);
  if (v === "pay") return payView(user, loan);
  if (v === "history") return historyView(user, loan);
  if (v === "credit") return creditView(user, loan);
  if (v === "tiers") return tiersView(user, loan);
  if (v === "group") return groupView(user, loan);
  if (v === "ussd") return ussdView(user);
  if (v === "faq") return faqView(user);
  if (v === "help") return helpView(user);
  if (v === "alerts") return alertsView(user);
  if (v === "profile") return profileView(user, loan);
  if (v === "more") return moreView(user);
  if (v === "offer") return offerView(user, loan);
  return homeView(user, loan);
}
function homeView(user, loan) {
  if (!loan) return `<h2>No box yet</h2><button class="btn" data-go="signup">Open one</button>`;
  const pct = Math.round((loan.months / loan.maxMonths) * 100);
  const unread = state.notifications.filter(n => n.userId === user.id && !n.read).length;
  return `${banners()}
    <div class="split"><p class="kicker">My Susu dashboard</p><button class="chip" data-go="alerts">Alerts ${unread}</button></div>
    <div class="split"><h2>${esc(user.name.split(" ")[0])}'s box</h2><span class="badge b-${loan.tier.toLowerCase()}">${esc(loan.tier)} builder</span></div>
    <div class="progress-wrap">
      <div class="ring" style="--p:${pct}"><i>${loan.months}/${loan.maxMonths}<br><span class="small">months</span></i></div>
      <div>
        <div class="stat"><span>Status</span><b>${esc(loan.status.replaceAll("_", " "))}</b></div>
        <p class="hint">${loan.status === "GRACE" ? `Grace started ${loan.graceStart}. Fund before day ${cfg().graceDays + 1} or the box self-liquidates.` : loan.status === "MATURED_SUCCESS" ? "Box broken. Savings are back in your wallet. SME line is open." : loan.status === "DEFAULT_CLOSED" ? "Box was broken by set-off. Personal drops were refunded. No balance owed." : `Next automatic pull ${money(cfg().customerShare)} on ${loan.nextDue || "—"}.`}</p>
      </div>
    </div>
    <div class="grid-2" style="margin-top:12px">
      <div class="stat"><span>Savings reward</span><b>${money(loan.contributed)}</b></div>
      <div class="stat"><span>Interest discount</span><b>${loan.discount}%</b></div>
      <div class="stat"><span>Locked escrow</span><b>${money(loan.locked)}</b></div>
      <div class="stat"><span>Unlocked limit</span><b>${money(loan.limit)}</b></div>
    </div>
    <div style="height:12px"></div>
    <button class="btn btn-block" data-go="pay" ${loan.status === "ACTIVE" || loan.status === "GRACE" ? "" : "disabled"}>Drop ${money(cfg().customerShare)} now</button>
    <p class="footer-note">Keep at least ${money(cfg().customerShare)} in ${esc(user.provider)} so the pull does not miss. Bureau: XDS Data Ghana.</p>`;
}
function boxView(user, loan) {
  return `${banners()}<p class="kicker">Credit box</p><h2>Locked escrow</h2>
    <div class="hero-box"><div class="small">Still locked</div><div style="font-size:28px;font-weight:750">${money(loan.locked)}</div>
    <p>This is the bank's collateral, not spendable cash. Each on-time month releases ${money(cfg().bankSweep)} into the reported payment.</p></div>
    <div class="list">
      <div class="row-card"><div><b>Opened</b><div class="small muted">${esc(loan.openedAt)}</div></div><span>${esc(loan.id)}</span></div>
      <div class="row-card"><div><b>Your drops</b><div class="small muted">Refunded in full at month 12, or on set-off</div></div><span>${money(loan.contributed)}</span></div>
      <div class="row-card"><div><b>Reported installment</b></div><span>${money(cfg().monthlyDue)}</span></div>
      <div class="row-card"><div><b>Your share / bank sweep</b></div><span>${money(cfg().customerShare)} + ${money(cfg().bankSweep)}</span></div>
    </div>
    <div style="height:10px"></div>
    <button class="btn-ghost btn-block" data-go="history">Payment history</button>
    <div style="height:8px"></div>
    <button class="btn-ghost btn-block" data-go="credit">Bureau file</button>`;
}
function payView(user, loan) {
  const payable = loan && (loan.status === "ACTIVE" || loan.status === "GRACE");
  return `${banners()}<p class="kicker">Monthly drop</p><h2>Pay ${money(cfg().customerShare)}</h2>
    <p class="hint">Channel: ${esc(user.provider)} ${esc(user.momo)}. Wallet balance ${money(user.wallet)}. Ledger fee ${money(cfg().ledgerFee)} is recognized inside this drop. The bank sweep of ${money(cfg().bankSweep)} does not leave your wallet.</p>
    <button class="btn btn-block" id="do-pay" ${payable ? "" : "disabled"}>Pull from MoMo</button>
    <div style="height:8px"></div>
    <button class="btn-ghost btn-block" id="do-miss" ${loan && loan.status === "ACTIVE" ? "" : "disabled"}>Simulate a missed pull</button>
    <div style="height:8px"></div>
    <button class="btn-gold btn-block" data-go="ussd">Pay on USSD instead</button>
    ${historyList(user, 4)}`;
}
function historyView(user) {
  return `${banners()}<p class="kicker">Ledger</p><h2>Drops & sweeps</h2>${historyList(user, 20)}`;
}
function historyList(user, n) {
  const rows = state.ledger.filter(t => t.userId === user.id).slice(-n).reverse();
  if (!rows.length) return `<p class="hint">No drops yet.</p>`;
  return `<div class="list" style="margin-top:10px">${rows.map(t => `<div class="row-card"><div><b>${esc(t.type.replaceAll("_", " "))}</b><div class="small muted">${esc(t.date)} · ${esc(t.channel)} · ${esc(t.ref)}</div></div><div style="text-align:right"><span class="badge b-ok">${esc(t.status)}</span><div class="small">${money(t.amount)}</div></div></div>`).join("")}</div>`;
}
function creditView(user) {
  const rows = state.bureau.filter(b => b.userId === user.id);
  return `${banners()}<p class="kicker">XDS Data Ghana</p><h2>Credit file</h2>
    <p class="hint">On-time months are reported as ${money(cfg().monthlyDue)}. Grace holds the report. Set-off is reported as a closure, not a lingering debt.</p>
    <div class="list">${rows.length ? rows.slice().reverse().map(b => `<div class="row-card"><div><b>Month ${b.month}</b><div class="small muted">${esc(b.date)} · ${esc(b.bureau)}</div></div><span class="badge ${b.status === "REPORTED" ? "b-ok" : "b-warn"}">${esc(b.status)} · ${money(b.amount)}</span></div>`).join("") : `<p class="hint">Nothing reported yet.</p>`}</div>`;
}
function tiersView(user, loan) {
  const steps = [
    ["BRONZE", "Box opened", "Locked GH₵ 600. Bureau syncing starts."],
    ["SILVER", `Month ${cfg().silverMonth}`, "Three clean drops. Discount starts."],
    ["GOLD", `Month ${cfg().goldMonth}`, `Preview limit ${money(cfg().goldPreviewLimit)}.`],
    ["PLATINUM", "Month 12", `Savings back. SME line ${money(cfg().platinumLimit)}.`]
  ];
  return `${banners()}<p class="kicker">Progress ladder</p><h2>${esc(loan.tier)} builder</h2>
    <div class="ladder">${steps.map((s, i) => {
      const on = ["BRONZE", "SILVER", "GOLD", "PLATINUM"].indexOf(loan.tier) >= i;
      return `<div class="step"><div><div class="dot ${on ? "on" : ""}">${i + 1}</div>${i < 3 ? `<div class="rail"></div>` : ""}</div><div><b>${s[0]} · ${s[1]}</b><div class="small muted">${s[2]}</div></div></div>`;
    }).join("")}</div>
    <button class="btn btn-block" data-go="offer" ${loan.status === "MATURED_SUCCESS" ? "" : "disabled"}>Open graduation offer</button>`;
}
function offerView(user, loan) {
  return `${banners()}<p class="kicker">Cross-sell</p><h2>Working capital line</h2>
    <div class="hero-box"><div class="small">${esc(loan.offerStatus)}</div><div style="font-size:28px;font-weight:750">${money(loan.limit)}</div>
    <p>Non-collateralized, funded by ${esc(cfg().bankName)}. Your discount is ${loan.discount}% off the bank's standard SME rate. This app does not disburse the line. It sends a pre-approved file.</p></div>
    <button class="btn btn-block" id="take-offer" ${loan.offerStatus === "AVAILABLE" ? "" : "disabled"}>Request the line</button>
    <p class="hint">${loan.offerStatus === "REQUESTED" ? "Ops has your request. The bank funds it." : "Available only after a clean maturity."}</p>`;
}
function groupView(user, loan) {
  if (!cfg().features.groupSusu) return `<h2>Group Susu is off</h2><p class="hint">A super admin can enable it.</p>`;
  const mine = state.groups.filter(g => g.memberIds.includes(user.id));
  const others = state.groups.filter(g => !g.memberIds.includes(user.id));
  return `${banners()}<p class="kicker">Market association</p><h2>Group box</h2>
    <p class="hint">If one member misses a drop, the group pool can cover it. The covered member still owes the pool, not the bank.</p>
    ${mine.map(g => `<div class="card"><b>${esc(g.name)}</b><div class="small muted">Code ${esc(g.code)} · pool ${money(g.pool)} · ${g.memberIds.length} members</div>
      <div style="height:8px"></div><button class="btn" data-cover="${g.id}" ${loan && loan.status === "GRACE" ? "" : "disabled"}>Cover my grace from pool</button></div>`).join("") || `<p class="hint">You are not in a group.</p>`}
    <div class="field" style="margin-top:12px"><label>Join with code</label><input id="join-code" placeholder="MAKOLA"></div>
    <button class="btn-ghost btn-block" id="join-group">Join group</button>
    <div style="height:8px"></div>
    <div class="field"><label>New group name</label><input id="new-group" placeholder="Kejetia Cloth"></div>
    <button class="btn-ghost btn-block" id="create-group">Create group</button>
    <p class="hint">Open groups: ${others.map(g => esc(g.name)).join(", ") || "none"}</p>`;
}
function ussdView(user) {
  const screen = state.ussd.screen;
  const lines = {
    home: `${cfg().ussdCode}\n${cfg().productName}\n1. Box balance\n2. Pay GH₵ ${cfg().customerShare}\n3. FAQ\n4. Group pool\n0. Exit`,
    balance: user ? `Box ${loanOf(user.id)?.status || "NONE"}\nLocked ${money(loanOf(user.id)?.locked || 0)}\nDrops ${loanOf(user.id)?.months || 0}/12\n1. Back` : `Log in on the app first.\n1. Back`,
    faq: `1. What is it?\n2. Cost\n3. If I miss\n4. Privacy\n0. Back`,
    group: `Group pool cover\nReply 1 to cover grace\n0. Back`
  };
  return `${banners()}<p class="kicker">Feature phone channel</p><h2>USSD ${esc(cfg().ussdCode)}</h2>
    <div class="ussd">${esc(lines[screen] || lines.home)}</div>
    <div class="ussd-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map(k => `<button data-ussd="${k}">${k}</button>`).join("")}</div>
    <p class="footer-note">Same ledger as the app. Channel tag USSD_385. Informal traders can pay without a smartphone.</p>`;
}
function faqView(user) {
  return `${banners()}<p class="kicker">Support center</p><h2>FAQ</h2>
    <div class="list">${FAQ.map(([key, q, a]) => `<details class="faq" data-faq="${key}"><summary><b>${esc(key)}</b> ${esc(q)}</summary><p class="hint">${esc(a)}</p></details>`).join("")}</div>`;
}
function helpView(user) {
  const mine = state.tickets.filter(t => t.userId === user.id);
  return `${banners()}<p class="kicker">Help</p><h2>Talk to a person</h2>
    <p class="hint">Desk ${esc(cfg().supportPhone)}. Tier 1 answers product questions. Tier 2 handles ledger, set-off, and bureau disputes.</p>
    <div class="field"><label>Topic</label><select id="t-topic"><option>Missed drop</option><option>MoMo did not link</option><option>Ghana Card mismatch</option><option>Bureau not updated</option><option>Break box early</option><option>Group pool</option><option>Something else</option></select></div>
    <div class="field"><label>What happened</label><textarea id="t-body" placeholder="Market was slow this week."></textarea></div>
    <button class="btn btn-block" id="send-ticket">Send to help desk</button>
    <div class="list" style="margin-top:12px">${mine.map(t => `<div class="ticket"><b>${esc(t.topic)}</b> <span class="badge b-info">${esc(t.status)}</span><p class="hint">${esc(t.body)}</p>${t.replies.map(r => `<p class="small"><b>${esc(r.by)}</b> · ${esc(r.text)}</p>`).join("")}</div>`).join("") || `<p class="hint">No tickets yet.</p>`}</div>
    <div style="height:8px"></div>
    <button class="btn-ghost btn-block" data-go="faq">Read FAQ first</button>`;
}
function alertsView(user) {
  const rows = state.notifications.filter(n => n.userId === user.id);
  return `${banners()}<p class="kicker">Alerts</p><h2>What changed</h2>
    <div class="list">${rows.map(n => `<div class="row-card"><div><b>${esc(n.text)}</b><div class="small muted">${esc(n.at)}</div></div></div>`).join("") || `<p class="hint">Quiet for now.</p>`}</div>`;
}
function profileView(user, loan) {
  return `${banners()}<p class="kicker">Profile</p><h2>${esc(user.name)}</h2>
    <div class="list">
      <div class="row-card"><span>Ghana Card</span><b>${esc(user.ghanaCard)}</b></div>
      <div class="row-card"><span>MoMo</span><b>${esc(user.provider)} ${esc(user.momo)}</b></div>
      <div class="row-card"><span>Metadata score</span><b>${user.score ?? "—"}</b></div>
      <div class="row-card"><span>Channel</span><b>${esc(user.channel)}</b></div>
    </div>
    <hr class="soft">
    <label class="toggle"><input type="checkbox" id="p-scan" ${user.consents.scan ? "checked" : ""}><span>Phone scan consent</span></label>
    <label class="toggle"><input type="checkbox" id="p-bureau" ${user.consents.bureau ? "checked" : ""}><span>Monthly XDS consent</span></label>
    <button class="btn-ghost btn-block" id="save-consent">Save consents</button>
    <div style="height:8px"></div>
    <button class="btn-danger btn-block" id="break-box" ${loan && (loan.status === "ACTIVE" || loan.status === "GRACE") ? "" : "disabled"}>Break box early</button>
    <p class="footer-note">Early break uses the same set-off path. Personal drops return. Bureau gets a closure, not a debt.</p>`;
}
function moreView(user) {
  return `${banners()}<p class="kicker">More</p><h2>Everything else</h2>
    <div class="list">
      ${[["history", "Payment history"], ["credit", "Bureau file"], ["tiers", "Tier ladder"], ["offer", "SME line"], ["group", "Group Susu"], ["ussd", "USSD " + cfg().ussdCode], ["faq", "FAQ"], ["alerts", "Alerts"], ["profile", "Profile & consents"]].map(([id, label]) => `<button class="row-card" data-go="${id}"><b>${esc(label)}</b><span>›</span></button>`).join("")}
    </div>`;
}

function adminShell(user) {
  const items = [["command", "Command"], ["customers", "Customers"], ["loans", "Loans"], ["collections", "Collections"], ["bureau", "Bureau"], ["webhooks", "MoMo webhooks"], ["desk", "Help desk"], ["faq", "FAQ analytics"], ["groups", "Groups"], ["audit", "Audit"]];
  if (user.role === "SUPER") items.push(["config", "Product controls"], ["roles", "Roles & flags"]);
  return `<div class="admin-grid">
    <aside class="side">
      <p class="kicker">${esc(user.role)}</p>
      <h3>${esc(user.name)}</h3>
      ${items.map(([id, label]) => `<button class="chip ${state.adminView === id ? "on" : ""}" data-admin="${id}" style="margin-bottom:6px">${label}</button>`).join("")}
      <button class="btn-ghost btn-block" data-logout="1">Log out</button>
    </aside>
    <section class="phone" style="min-height:auto"><div class="phone-body">${banners()}${adminView(user)}</div></section>
  </div>`;
}
function adminView(user) {
  const v = state.adminView;
  if (v === "customers") return customersAdmin();
  if (v === "loans") return loansAdmin();
  if (v === "collections") return collectionsAdmin(user);
  if (v === "bureau") return bureauAdmin();
  if (v === "webhooks") return webhookAdmin();
  if (v === "desk") return deskAdmin(user);
  if (v === "faq") return faqAdmin();
  if (v === "groups") return groupsAdmin();
  if (v === "audit") return auditAdmin();
  if (v === "config") return configAdmin(user);
  if (v === "roles") return rolesAdmin(user);
  return commandAdmin();
}
function kpis() {
  const customers = state.users.filter(u => u.role === "CUSTOMER");
  const active = state.loans.filter(l => l.status === "ACTIVE" || l.status === "GRACE");
  const locked = active.reduce((s, l) => s + Number(l.locked), 0);
  const fees = state.ledger.filter(t => t.type === "SETUP_FEE" || t.fee).reduce((s, t) => s + Number(t.fee || t.amount || 0), 0);
  const setup = state.ledger.filter(t => t.type === "SETUP_FEE").reduce((s, t) => s + Number(t.amount), 0);
  return `<div class="kpi-grid">
    <div class="stat"><span>Customers</span><b>${customers.length}</b></div>
    <div class="stat"><span>Live boxes</span><b>${active.length}</b></div>
    <div class="stat"><span>Locked escrow</span><b>${money(locked)}</b></div>
    <div class="stat"><span>Fee ledger</span><b>${money(setup + state.ledger.filter(t => t.fee).reduce((s, t) => s + Number(t.fee), 0))}</b></div>
  </div>`;
}
function commandAdmin() {
  return `<p class="kicker">${cfg().sandbox ? "Sandbox" : "Live"} · ${esc(cfg().bankName)}</p><h2>Command center</h2>${kpis()}
    <div class="notice">100,000 boxes at ${money(cfg().principal)} would lock ${money(cfg().principal * 100000)} of non-withdrawable deposits. That treasury case lives in the strategy document, not in this ledger.</div>
    <button class="btn" id="run-billing">Run billing day</button>
    <button class="btn-ghost" id="export-csv">Export customers</button>
    <h3 style="margin-top:16px">Needs a human</h3>
    <div class="list">${state.loans.filter(l => l.status === "GRACE" || l.status === "PENDING").map(l => {
      const u = state.users.find(x => x.id === l.userId);
      return `<div class="row-card"><div><b>${esc(u.name)}</b><div class="small muted">${esc(l.status)} · due ${esc(l.nextDue || "—")}</div></div><button class="chip" data-impersonate="${u.id}">Open as</button></div>`;
    }).join("") || `<p class="hint">Queue is clear.</p>`}</div>`;
}
function customersAdmin() {
  const rows = state.users.filter(u => u.role === "CUSTOMER");
  return `<h2>Customers</h2><table><tr><th>Name</th><th>Phone</th><th>Card</th><th>Score</th><th>Wallet</th><th></th></tr>
    ${rows.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.phone)}<div class="small muted">${esc(u.provider)}</div></td><td>${esc(u.ghanaCard)}</td><td>${u.score ?? "—"}</td><td>${money(u.wallet)}</td><td><button class="chip" data-impersonate="${u.id}">Open</button></td></tr>`).join("")}</table>`;
}
function loansAdmin() {
  return `<h2>Loans & escrow</h2><table><tr><th>Customer</th><th>Status</th><th>Tier</th><th>Months</th><th>Locked</th><th>Saved</th></tr>
    ${state.loans.map(l => {
      const u = state.users.find(x => x.id === l.userId);
      return `<tr><td>${esc(u.name)}</td><td>${esc(l.status)}</td><td>${esc(l.tier)}</td><td>${l.months}/${l.maxMonths}</td><td>${money(l.locked)}</td><td>${money(l.contributed)}</td></tr>`;
    }).join("")}</table>`;
}
function collectionsAdmin(actor) {
  return `<h2>Grace & set-off</h2>
    <p class="hint">Day 16 liquidates the locked box, refunds personal drops, reports closure, and leaves a zero balance. No penalty fee.</p>
    <table><tr><th>Customer</th><th>Status</th><th>Grace start</th><th></th></tr>
    ${state.loans.filter(l => l.status === "ACTIVE" || l.status === "GRACE").map(l => {
      const u = state.users.find(x => x.id === l.userId);
      return `<tr><td>${esc(u.name)}</td><td>${esc(l.status)}</td><td>${esc(l.graceStart || "—")}</td><td>
        <button class="chip" data-grace="${l.id}">Start grace</button>
        <button class="chip" data-setoff="${l.id}">Set off now</button>
      </td></tr>`;
    }).join("")}</table>`;
}
function bureauAdmin() {
  return `<h2>Bureau queue</h2><table><tr><th>Customer</th><th>Month</th><th>Amount</th><th>Status</th><th></th></tr>
    ${state.bureau.slice().reverse().slice(0, 20).map(b => {
      const u = state.users.find(x => x.id === b.userId);
      return `<tr><td>${esc(u?.name || "")}</td><td>${b.month}</td><td>${money(b.amount)}</td><td>${esc(b.status)}</td><td>${b.status !== "REPORTED" ? `<button class="chip" data-report="${b.id}">Mark reported</button>` : ""}</td></tr>`;
    }).join("")}</table>`;
}
function webhookAdmin() {
  return `<h2>MoMo callbacks</h2>
    <p class="hint">GhIPSS callbacks must match HMAC before they move the ledger. Secret ends in ${esc(cfg().webhookSecret.slice(-4))}.</p>
    <div class="grid-2">
      <div class="field"><label>Provider</label><select id="wh-provider"><option>MTN</option><option>Telecel</option><option>AT Money</option></select></div>
      <div class="field"><label>Amount</label><input id="wh-amount" value="5"></div>
    </div>
    <label class="toggle"><input type="checkbox" id="wh-bad"><span>Send a bad signature (should reject)</span></label>
    <button class="btn" id="send-wh">Post callback</button>
    <table><tr><th>When</th><th>Provider</th><th>Ref</th><th>Verified</th><th>Status</th></tr>
      ${state.webhooks.map(w => `<tr><td>${esc(w.at)}</td><td>${esc(w.provider)}</td><td>${esc(w.ref)}</td><td>${w.verified ? "yes" : "no"}</td><td>${esc(w.status)}</td></tr>`).join("")}
    </table>`;
}
function deskAdmin(actor) {
  return `<h2>Help desk</h2>
    ${state.tickets.map(t => {
      const u = state.users.find(x => x.id === t.userId);
      return `<div class="ticket"><div class="split"><b>${esc(u?.name || "Customer")} · ${esc(t.topic)}</b><span class="badge b-info">${esc(t.status)}</span></div>
        <p>${esc(t.body)}</p>
        ${t.replies.map(r => `<p class="small"><b>${esc(r.by)}</b> ${esc(r.text)}</p>`).join("")}
        <div class="field"><input data-reply-for="${t.id}" placeholder="Reply"></div>
        <button class="btn" data-reply="${t.id}">Reply</button>
        <button class="btn-ghost" data-escalate="${t.id}">Escalate to tier 2</button>
        <button class="chip" data-close="${t.id}">Resolve</button>
      </div>`;
    }).join("") || `<p class="hint">No open tickets.</p>`}`;
}
function faqAdmin() {
  const counts = {};
  state.faqClicks.forEach(c => { counts[c.key] = (counts[c.key] || 0) + 1; });
  const total = state.faqClicks.length || 1;
  return `<h2>FAQ analytics</h2>
    <p class="hint">Which questions informal traders actually open. Q7 is the debt-trap worry. Q8 is privacy.</p>
    <table><tr><th>Key</th><th>Clicks</th><th>Share</th></tr>
      ${FAQ.map(([k]) => `<tr><td>${k}</td><td>${counts[k] || 0}</td><td>${(((counts[k] || 0) / total) * 100).toFixed(0)}%</td></tr>`).join("")}
    </table>
    <h3>By channel</h3>
    <table><tr><th>Channel</th><th>Key</th><th>Tier</th></tr>
      ${state.faqClicks.map(c => `<tr><td>${esc(c.channel)}</td><td>${esc(c.key)}</td><td>${esc(c.tier)}</td></tr>`).join("")}
    </table>`;
}
function groupsAdmin() {
  return `<h2>Group vaults</h2>${state.groups.map(g => `<div class="card"><b>${esc(g.name)}</b> · ${esc(g.code)} · pool ${money(g.pool)}<div class="small muted">${g.memberIds.map(id => esc(state.users.find(u => u.id === id)?.name || "")).join(", ")}</div></div>`).join("")}`;
}
function auditAdmin() {
  return `<h2>Audit log</h2><table><tr><th>When</th><th>Actor</th><th>Action</th></tr>${state.audit.slice(0, 40).map(a => `<tr><td>${esc(a.at)}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td></tr>`).join("")}</table>`;
}
function configAdmin(user) {
  if (user.role !== "SUPER") return `<h2>Super admin only</h2>`;
  const c = cfg();
  const fields = [["principal", "Locked principal"], ["customerShare", "Customer drop"], ["bankSweep", "Bank sweep"], ["monthlyDue", "Reported installment"], ["setupFee", "Activation fee"], ["ledgerFee", "Ledger fee"], ["termMonths", "Term months"], ["graceDays", "Grace days"], ["platinumLimit", "Platinum limit"], ["goldPreviewLimit", "Gold preview limit"], ["scoreFloor", "Score floor"], ["silverMonth", "Silver at month"], ["goldMonth", "Gold at month"]];
  return `<h2>Product controls</h2>
    <div class="field"><label>Product name</label><input id="cfg-productName" value="${esc(c.productName)}"></div>
    <div class="field"><label>Partner bank</label><input id="cfg-bankName" value="${esc(c.bankName)}"></div>
    <div class="field"><label>USSD code</label><input id="cfg-ussdCode" value="${esc(c.ussdCode)}"></div>
    <div class="field"><label>Support line</label><input id="cfg-supportPhone" value="${esc(c.supportPhone)}"></div>
    <div class="grid-2">${fields.map(([k, label]) => `<div class="field"><label>${label}</label><input id="cfg-${k}" value="${esc(c[k])}"></div>`).join("")}</div>
    <label class="toggle"><input type="checkbox" id="cfg-signupOpen" ${c.signupOpen ? "checked" : ""}><span>New signups open</span></label>
    <label class="toggle"><input type="checkbox" id="cfg-sandbox" ${c.sandbox ? "checked" : ""}><span>Sandbox mode</span></label>
    <button class="btn" id="save-config">Save controls</button>
    <p class="hint">Changing principal does not rewrite boxes already open. New signups use the new numbers. Customer share plus bank sweep should equal the reported installment.</p>`;
}
function rolesAdmin(user) {
  if (user.role !== "SUPER") return `<h2>Super admin only</h2>`;
  return `<h2>Roles & flags</h2>
    <label class="toggle"><input type="checkbox" id="flag-group" ${cfg().features.groupSusu ? "checked" : ""}><span>Group Susu</span></label>
    <label class="toggle"><input type="checkbox" id="flag-ussd" ${cfg().features.ussd ? "checked" : ""}><span>USSD channel</span></label>
    <label class="toggle"><input type="checkbox" id="flag-scan" ${cfg().features.metadataScan ? "checked" : ""}><span>Metadata scan</span></label>
    <label class="toggle"><input type="checkbox" id="flag-sme" ${cfg().features.smeLine ? "checked" : ""}><span>SME graduation line</span></label>
    ${Object.keys(cfg().providers).map(p => `<label class="toggle"><input type="checkbox" data-provider="${esc(p)}" ${cfg().providers[p] ? "checked" : ""}><span>${esc(p)} MoMo</span></label>`).join("")}
    <button class="btn" id="save-flags">Save flags</button>
    <h3>Staff</h3>
    <table><tr><th>Name</th><th>Username</th><th>Role</th></tr>
      ${state.users.filter(u => u.role !== "CUSTOMER").map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>
        <select data-role-for="${u.id}">${["SUPPORT", "OPS", "SUPER"].map(r => `<option ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}</select>
      </td></tr>`).join("")}
    </table>
    <button class="btn-ghost" id="save-roles">Update roles</button>`;
}

function applyTier(loan) {
  loan.tier = tierFor(loan.months, loan.status);
  loan.discount = cfg().discounts[loan.tier] || 0;
  loan.limit = loan.status === "MATURED_SUCCESS" ? cfg().platinumLimit : limitFor(loan.tier, cfg());
}
function postPayment(user, loan, channel) {
  if (user.wallet < cfg().customerShare) return fail("Wallet is short. Add MoMo float or wait for grace.");
  user.wallet = Math.round((user.wallet - cfg().customerShare) * 100) / 100;
  loan.locked = Math.round((loan.locked - cfg().bankSweep) * 100) / 100;
  loan.contributed = Math.round((loan.contributed + cfg().customerShare) * 100) / 100;
  loan.months += 1;
  loan.status = loan.months >= cfg().termMonths ? "MATURED_SUCCESS" : "ACTIVE";
  loan.graceStart = null;
  if (loan.status === "MATURED_SUCCESS") {
    user.wallet = Math.round((user.wallet + loan.contributed) * 100) / 100;
    loan.locked = 0;
    loan.offerStatus = "AVAILABLE";
    notify(user.id, `Box broken. ${money(loan.contributed)} is back in your wallet. SME line is open.`);
  } else {
    loan.nextDue = addMonths(todayISO(0), 1);
    notify(user.id, `Month ${loan.months} reported to XDS as ${money(cfg().monthlyDue)}.`);
  }
  applyTier(loan);
  state.ledger.push({ id: uid("tx"), loanId: loan.id, userId: user.id, amount: cfg().customerShare, fee: cfg().ledgerFee, sweep: cfg().bankSweep, type: "CO_PAYMENT", channel, status: "SUCCESS", date: todayISO(0), ref: "PAY-" + loan.months });
  if (user.consents.bureau) {
    state.bureau.push({ id: uid("bur"), loanId: loan.id, userId: user.id, month: loan.months, amount: cfg().monthlyDue, status: "REPORTED", bureau: "XDS Data Ghana", date: todayISO(0) });
  }
  audit(`Co-payment month ${loan.months} for ${user.name} via ${channel}`);
  flash(loan.status === "MATURED_SUCCESS" ? "Susu complete. Savings released." : "Drop received. Bureau updated.");
}
function setOff(loan, reason) {
  const user = state.users.find(u => u.id === loan.userId);
  const refund = loan.contributed;
  user.wallet = Math.round((user.wallet + refund) * 100) / 100;
  state.ledger.push({ id: uid("tx"), loanId: loan.id, userId: user.id, amount: loan.locked, fee: 0, sweep: 0, type: "RIGHT_OF_SET_OFF", channel: "INTERNAL_APP", status: "SUCCESS", date: todayISO(0), ref: "SET-" + loan.id.slice(-4) });
  if (refund) state.ledger.push({ id: uid("tx"), loanId: loan.id, userId: user.id, amount: refund, fee: 0, sweep: 0, type: "SAVINGS_REFUND", channel: "MTN_MOMO_API", status: "SUCCESS", date: todayISO(0), ref: "REF-" + loan.id.slice(-4) });
  loan.locked = 0;
  loan.contributed = 0;
  loan.status = "DEFAULT_CLOSED";
  loan.nextDue = null;
  loan.limit = 0;
  state.bureau.push({ id: uid("bur"), loanId: loan.id, userId: user.id, month: loan.months, amount: 0, status: "CLOSURE_REPORTED", bureau: "XDS Data Ghana", date: todayISO(0) });
  notify(user.id, `Box broken by set-off. ${money(refund)} refunded. You owe nothing.`);
  audit(`${reason} set-off for ${user.name}`);
}
function billingDay() {
  let n = 0;
  state.loans.forEach(loan => {
    if (loan.status !== "ACTIVE" && loan.status !== "GRACE") return;
    if (loan.nextDue && loan.nextDue > todayISO(0)) return;
    const user = state.users.find(u => u.id === loan.userId);
    if (user.wallet >= cfg().customerShare) {
      postPayment(user, loan, "INTERNAL_APP");
      n++;
    } else if (loan.status === "ACTIVE") {
      loan.status = "GRACE";
      loan.graceStart = todayISO(0);
      notify(user.id, "Drop missed. 15-day grace is open. Your score is not marked late yet.");
      n++;
    } else if (loan.graceStart && daysBetween(loan.graceStart, todayISO(0)) > cfg().graceDays) {
      setOff(loan, "T+16 daemon");
      n++;
    }
  });
  audit(`Billing day processed ${n} accounts`);
  flash(`Billing day touched ${n} accounts.`);
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function bind() {
  document.querySelectorAll("[data-go]").forEach(el => el.onclick = () => {
    state.view = el.dataset.go;
    state.flash = ""; state.error = "";
    if (el.dataset.go === "signup") state.signup = { step: 1 };
    if (el.dataset.go === "alerts") state.notifications.forEach(n => { if (n.userId === state.session) n.read = true; });
    render();
  });
  document.querySelectorAll("[data-admin]").forEach(el => el.onclick = () => { state.adminView = el.dataset.admin; state.flash = ""; render(); });
  document.querySelectorAll("[data-jump]").forEach(el => el.onclick = () => jump(el.dataset.jump));
  document.querySelectorAll("[data-reset]").forEach(el => el.onclick = resetDemo);
  document.querySelectorAll("[data-logout]").forEach(el => el.onclick = () => { state.session = null; state.view = "welcome"; flash("Logged out."); render(); });
  const login = document.getElementById("do-login");
  if (login) login.onclick = () => {
    const id = document.getElementById("login-id").value.trim();
    const pin = document.getElementById("login-pin").value.trim();
    const user = state.users.find(u => u.phone === id || u.username === id);
    if (!user || user.pin !== pin) return fail("Number or PIN does not match."), render();
    state.session = user.id;
    state.view = user.role === "CUSTOMER" ? "home" : "home";
    state.adminView = "command";
    flash("Box open.");
    render();
  };
  const next = document.getElementById("su-next");
  if (next) next.onclick = signupNext;
  const scan = document.getElementById("su-scan");
  if (scan) scan.onclick = () => {
    state.signup.scan = document.getElementById("c-scan").checked;
    state.signup.bureau = document.getElementById("c-bureau").checked;
    state.signup.terms = document.getElementById("c-terms").checked;
    if (!state.signup.scan || !state.signup.bureau || !state.signup.terms) return fail("Both permissions and the fee disclosure are required."), render();
    state.signup.step = 3;
    state.signup.scanning = true;
    render();
    setTimeout(() => {
      state.signup.score = 58 + Math.floor(Math.random() * 35);
      state.signup.scanning = false;
      render();
    }, 700);
  };
  const finish = document.getElementById("su-finish");
  if (finish) finish.onclick = finishSignup;
  const pay = document.getElementById("do-pay");
  if (pay) pay.onclick = () => {
    const user = sessionUser();
    const loan = loanOf(user.id);
    postPayment(user, loan, user.provider === "MTN" ? "MTN_MOMO_API" : "INTERNAL_APP");
    render();
  };
  const miss = document.getElementById("do-miss");
  if (miss) miss.onclick = () => {
    const loan = loanOf(sessionUser().id);
    loan.status = "GRACE";
    loan.graceStart = todayISO(0);
    notify(sessionUser().id, "Missed drop simulated. Grace is open for 15 days.");
    audit("Customer simulated a miss");
    flash("Grace period started. Score not marked late yet.");
    render();
  };
  document.querySelectorAll("[data-ussd]").forEach(el => el.onclick = () => ussdPress(el.dataset.ussd));
  document.querySelectorAll("[data-faq]").forEach(el => el.addEventListener("toggle", () => {
    if (!el.open) return;
    const user = sessionUser();
    const loan = user ? loanOf(user.id) : null;
    state.faqClicks.unshift({ id: uid("faq"), key: el.dataset.faq, channel: user?.channel || "NATIVE_APP", tier: loan?.tier || "BRONZE", at: todayISO(0) });
  }));
  const ticket = document.getElementById("send-ticket");
  if (ticket) ticket.onclick = () => {
    const user = sessionUser();
    state.tickets.unshift({ id: uid("tkt"), userId: user.id, topic: document.getElementById("t-topic").value, body: document.getElementById("t-body").value || "No detail given.", status: "TIER1", tier: 1, createdAt: todayISO(0), replies: [] });
    flash("Help desk has it.");
    render();
  };
  const consent = document.getElementById("save-consent");
  if (consent) consent.onclick = () => {
    const user = sessionUser();
    user.consents.scan = document.getElementById("p-scan").checked;
    user.consents.bureau = document.getElementById("p-bureau").checked;
    audit(`${user.name} updated consents`);
    flash(user.consents.bureau ? "Consents saved." : "Bureau updates paused until you opt back in.");
    render();
  };
  const breakBox = document.getElementById("break-box");
  if (breakBox) breakBox.onclick = () => {
    setOff(loanOf(sessionUser().id), "Customer early break");
    flash("Box broken. Personal drops refunded. Nothing owed.");
    render();
  };
  const join = document.getElementById("join-group");
  if (join) join.onclick = () => {
    const code = document.getElementById("join-code").value.trim().toUpperCase();
    const g = state.groups.find(x => x.code === code);
    if (!g) return fail("No group with that code."), render();
    if (!g.memberIds.includes(state.session)) g.memberIds.push(state.session);
    loanOf(state.session).groupId = g.id;
    flash("Joined " + g.name);
    render();
  };
  const create = document.getElementById("create-group");
  if (create) create.onclick = () => {
    const name = document.getElementById("new-group").value.trim();
    if (!name) return fail("Name the group."), render();
    const g = { id: uid("grp"), name, code: name.slice(0, 6).toUpperCase().replace(/\s/g, ""), pool: 0, memberIds: [state.session], createdAt: todayISO(0) };
    state.groups.push(g);
    loanOf(state.session).groupId = g.id;
    flash("Group created. Code " + g.code);
    render();
  };
  document.querySelectorAll("[data-cover]").forEach(el => el.onclick = () => {
    const g = state.groups.find(x => x.id === el.dataset.cover);
    const loan = loanOf(state.session);
    if (!g || g.pool < cfg().customerShare) return fail("Group pool is short."), render();
    g.pool -= cfg().customerShare;
    const user = sessionUser();
    user.wallet += cfg().customerShare;
    postPayment(user, loan, "GROUP_RECOVERY");
    audit(`Group ${g.name} covered ${user.name}`);
    render();
  });
  const offer = document.getElementById("take-offer");
  if (offer) offer.onclick = () => {
    const loan = loanOf(sessionUser().id);
    loan.offerStatus = "REQUESTED";
    audit(`${sessionUser().name} requested SME line ${loan.limit}`);
    flash("Request sent to the bank. They fund it. You do not.");
    render();
  };
  const billing = document.getElementById("run-billing");
  if (billing) billing.onclick = () => { billingDay(); render(); };
  const exp = document.getElementById("export-csv");
  if (exp) exp.onclick = exportCsv;
  document.querySelectorAll("[data-impersonate]").forEach(el => el.onclick = () => {
    state.session = el.dataset.impersonate;
    state.view = "home";
    flash("Opened customer box.");
    render();
  });
  document.querySelectorAll("[data-grace]").forEach(el => el.onclick = () => {
    const loan = state.loans.find(l => l.id === el.dataset.grace);
    loan.status = "GRACE"; loan.graceStart = todayISO(0);
    audit("Ops opened grace");
    flash("Grace opened.");
    render();
  });
  document.querySelectorAll("[data-setoff]").forEach(el => el.onclick = () => {
    setOff(state.loans.find(l => l.id === el.dataset.setoff), "Ops manual");
    flash("Set-off complete. Customer owes nothing.");
    render();
  });
  document.querySelectorAll("[data-report]").forEach(el => el.onclick = () => {
    const b = state.bureau.find(x => x.id === el.dataset.report);
    b.status = "REPORTED";
    audit("Bureau item marked reported");
    render();
  });
  const wh = document.getElementById("send-wh");
  if (wh) wh.onclick = () => {
    const bad = document.getElementById("wh-bad").checked;
    state.webhooks.unshift({ id: uid("wh"), at: new Date().toISOString(), provider: document.getElementById("wh-provider").value, status: bad ? "REJECTED" : "SUCCESS", ref: "MOMO-" + Math.floor(Math.random() * 90000), amount: Number(document.getElementById("wh-amount").value), verified: !bad });
    audit(bad ? "Webhook rejected on HMAC" : "Webhook accepted");
    flash(bad ? "Callback rejected. Ledger untouched." : "Callback verified and logged.");
    render();
  };
  document.querySelectorAll("[data-reply]").forEach(el => el.onclick = () => {
    const t = state.tickets.find(x => x.id === el.dataset.reply);
    const input = document.querySelector(`[data-reply-for="${t.id}"]`);
    t.replies.push({ by: sessionUser().name, text: input.value || "Noted.", at: todayISO(0) });
    t.status = "TIER1";
    notify(t.userId, "Help desk replied on " + t.topic);
    flash("Reply sent.");
    render();
  });
  document.querySelectorAll("[data-escalate]").forEach(el => el.onclick = () => {
    const t = state.tickets.find(x => x.id === el.dataset.escalate);
    t.status = "TIER2"; t.tier = 2;
    audit("Ticket escalated to tier 2");
    flash("Escalated.");
    render();
  });
  document.querySelectorAll("[data-close]").forEach(el => el.onclick = () => {
    state.tickets.find(x => x.id === el.dataset.close).status = "RESOLVED";
    flash("Resolved.");
    render();
  });
  const saveCfg = document.getElementById("save-config");
  if (saveCfg) saveCfg.onclick = () => {
    ["productName", "bankName", "ussdCode", "supportPhone"].forEach(k => state.config[k] = document.getElementById("cfg-" + k).value);
    ["principal", "customerShare", "bankSweep", "monthlyDue", "setupFee", "ledgerFee", "termMonths", "graceDays", "platinumLimit", "goldPreviewLimit", "scoreFloor", "silverMonth", "goldMonth"].forEach(k => state.config[k] = Number(document.getElementById("cfg-" + k).value));
    state.config.signupOpen = document.getElementById("cfg-signupOpen").checked;
    state.config.sandbox = document.getElementById("cfg-sandbox").checked;
    audit("Super admin updated product controls");
    flash("Controls saved. New boxes use the new numbers.");
    render();
  };
  const saveFlags = document.getElementById("save-flags");
  if (saveFlags) saveFlags.onclick = () => {
    state.config.features.groupSusu = document.getElementById("flag-group").checked;
    state.config.features.ussd = document.getElementById("flag-ussd").checked;
    state.config.features.metadataScan = document.getElementById("flag-scan").checked;
    state.config.features.smeLine = document.getElementById("flag-sme").checked;
    document.querySelectorAll("[data-provider]").forEach(el => state.config.providers[el.dataset.provider] = el.checked);
    audit("Feature flags updated");
    flash("Flags saved.");
    render();
  };
  const saveRoles = document.getElementById("save-roles");
  if (saveRoles) saveRoles.onclick = () => {
    document.querySelectorAll("[data-role-for]").forEach(el => {
      const u = state.users.find(x => x.id === el.dataset.roleFor);
      u.role = el.value;
    });
    audit("Roles updated");
    flash("Roles saved.");
    render();
  };
}
function signupNext() {
  const s = state.signup;
  if (!cfg().signupOpen) return fail("Signups are closed by super admin."), render();
  if (s.step === 1) {
    s.name = document.getElementById("su-name").value.trim();
    s.phone = document.getElementById("su-phone").value.trim();
    s.ghanaCard = document.getElementById("su-card").value.trim().toUpperCase();
    if (s.name.length < 3 || !/^0\d{9}$/.test(s.phone)) return fail("Use a full name and a 10-digit phone starting with 0."), render();
    if (!/^GHA-\d{9}-\d$/.test(s.ghanaCard)) return fail("Ghana Card should look like GHA-123456789-0."), render();
    if (state.users.some(u => u.phone === s.phone || u.ghanaCard === s.ghanaCard)) return fail("That phone or Ghana Card is already on a box."), render();
    s.step = 2;
  } else if (s.step === 3) {
    if (s.score < cfg().scoreFloor) return fail("Score is under the floor. Ops must review this phone before a box can open."), render();
    s.step = 4;
    s.provider = s.provider || "MTN";
    s.momo = s.phone;
  } else if (s.step === 4) {
    s.provider = document.getElementById("su-provider").value;
    s.momo = document.getElementById("su-momo").value.trim();
    if (!cfg().providers[s.provider]) return fail("That wallet is switched off."), render();
    s.step = 5;
  }
  state.error = "";
  render();
}
function finishSignup() {
  const s = state.signup;
  const pin = document.getElementById("su-pin").value.trim();
  const pin2 = document.getElementById("su-pin2").value.trim();
  if (!/^\d{4}$/.test(pin) || pin !== pin2) return fail("PIN must be 4 digits and match."), render();
  const user = {
    id: uid("usr"), role: "CUSTOMER", pin, name: s.name, phone: s.phone, ghanaCard: s.ghanaCard,
    provider: s.provider, momo: s.momo, score: s.score, consents: { scan: true, bureau: true, terms: true },
    wallet: 40, createdAt: todayISO(0), channel: "NATIVE_APP"
  };
  user.wallet -= cfg().setupFee;
  state.users.push(user);
  const loan = {
    id: uid("loan"), userId: user.id, principal: cfg().principal, locked: cfg().principal, contributed: 0,
    months: 0, maxMonths: cfg().termMonths, status: "ACTIVE", tier: "BRONZE", limit: 0,
    discount: 0, nextDue: addMonths(todayISO(0), 1), graceStart: null, openedAt: todayISO(0),
    groupId: null, offerStatus: "LOCKED"
  };
  state.loans.push(loan);
  state.ledger.push({ id: uid("tx"), loanId: loan.id, userId: user.id, amount: cfg().setupFee, fee: cfg().setupFee, sweep: 0, type: "SETUP_FEE", channel: s.provider, status: "SUCCESS", date: todayISO(0), ref: "SETUP" });
  state.session = user.id;
  state.view = "home";
  audit(`New box opened for ${user.name}`);
  notify(user.id, "Credit box is locked. First drop is due next month. You can pay early.");
  flash("Box open. Activation fee taken. Nothing to spend yet, on purpose.");
  render();
}
function ussdPress(key) {
  const u = state.ussd;
  if (u.screen === "home") {
    if (key === "1") u.screen = "balance";
    if (key === "2") {
      const user = sessionUser();
      if (!user) return fail("Log in on the app, then come back to USSD."), render();
      const loan = loanOf(user.id);
      if (loan && (loan.status === "ACTIVE" || loan.status === "GRACE")) postPayment(user, loan, "USSD_385");
      else fail("This box cannot take a drop.");
    }
    if (key === "3") u.screen = "faq";
    if (key === "4") u.screen = "group";
    if (key === "0") { state.view = sessionUser() ? "more" : "welcome"; u.screen = "home"; }
  } else if (key === "0" || key === "1") u.screen = "home";
  render();
}
function jump(role) {
  const map = { customer: "0244111001", support: "help.desk", ops: "ops.adjei", super: "super.admin" };
  const user = state.users.find(u => u.phone === map[role] || u.username === map[role]);
  state.session = user.id;
  state.view = "home";
  state.adminView = "command";
  state.flash = "";
  render();
}
function exportCsv() {
  const header = "name,phone,ghanaCard,provider,score,status,tier,months,locked,contributed\n";
  const lines = state.users.filter(u => u.role === "CUSTOMER").map(u => {
    const l = loanOf(u.id);
    return [u.name, u.phone, u.ghanaCard, u.provider, u.score, l.status, l.tier, l.months, l.locked, l.contributed].join(",");
  });
  const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mcb-customers.csv";
  a.click();
}
// render is started by extras.js after sandbox, engine, and reminder hooks attach
