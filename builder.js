const SAVE_CHOICES = [200, 400, 600, 1000, 2000];
const DEVICES = [
  { id: "infinix", name: "Infinix Smart", price: 180 },
  { id: "a05", name: "Samsung Galaxy A05", price: 250 },
  { id: "camon", name: "Tecno Camon", price: 250 }
];

function score850(user) {
  if (!user || user.score850 == null) {
    if (user && user.score != null) return Math.max(300, Math.min(850, Math.round(300 + Number(user.score) * 5.5)));
    return null;
  }
  return user.score850;
}
function monthDue(loan) {
  const base = Number(loan.savings || loan.principal || 0);
  return Math.round((base / (loan.maxMonths || cfg().termMonths || 12)) * 100) / 100;
}
function round2(n) { return Math.round(Number(n) * 100) / 100; }
function scoreWord(n) {
  if (n >= 750) return "Excellent";
  if (n >= 670) return "Good";
  if (n >= 580) return "Fair";
  return "Building";
}
function ensureBuilder() {
  const c = cfg();
  if (c.fastTrackScore == null) c.fastTrackScore = 700;
  if (c.agentCommission == null) c.agentCommission = 2;
  if (c.silverCushion == null) c.silverCushion = 50;
  if (c.goldDevice == null) c.goldDevice = 250;
  if (c.platinumDiscount == null) c.platinumDiscount = 25;
  if (c.minSave == null) c.minSave = 100;
  if (c.maxSave == null) c.maxSave = 5000;
  if (!state.fastPool) state.fastPool = [];
  if (!state.devices) state.devices = [];
  if (!state.cushions) state.cushions = [];
  if (!state.bankReports) state.bankReports = [];
  state.loans.forEach(function (l) {
    if (l.savings == null) l.savings = l.principal || c.principal;
    if (l.autopay == null) l.autopay = true;
    if (l.misses == null) l.misses = l.status === "GRACE" || l.status === "DEFAULT_CLOSED" ? 1 : 0;
    if (l.pushed == null) l.pushed = true;
  });
  state.users.forEach(function (u) {
    if (u.role === "CUSTOMER" && u.score850 == null && u.score != null) u.score850 = score850(u);
    if (!u.scoreLog && u.score850) u.scoreLog = [{ date: u.createdAt || todayISO(-30), score: u.score850, delta: 0 }];
    if (u.commission == null && u.role === "AGENT") u.commission = 0;
  });
  if (state.permissions) {
    ["report", "agents"].forEach(function (key) {
      ["OPS", "SUPER"].forEach(function (role) {
        const list = state.permissions[role];
        if (list && list.indexOf("*") < 0 && list.indexOf(key) < 0) list.push(key);
      });
    });
    if (state.permissions.SUPER && state.permissions.SUPER.indexOf("*") < 0 && state.permissions.SUPER.indexOf("pool") < 0) state.permissions.SUPER.push("pool");
  }
  if (!state.users.some(function (u) { return u.username === "agent.makola"; })) {
    state.users.push({
      id: uid("usr"), role: "AGENT", pin: "5555", username: "agent.makola", name: "Adwoa Mensah",
      phone: "0244007771", market: "Makola", ghanaCard: "", provider: "", momo: "0244007771",
      score: null, consents: {}, wallet: 0, commission: 0, enrolled: 0,
      createdAt: todayISO(-12), channel: "AGENT", active: true
    });
  }
  if (!state.users.some(function (u) { return u.phone === "0244777007"; })) {
    const id = uid("usr");
    state.users.push({
      id: id, role: "CUSTOMER", pin: "1234", name: "Kojo Fast", phone: "0244777007",
      ghanaCard: "GHA-700800900-7", provider: "MTN", momo: "0244777007", score: 82, score850: 751,
      scoreLog: [{ date: todayISO(-2), score: 751, delta: 0 }],
      consents: { scan: true, bureau: true, terms: true }, wallet: 30, track: "FAST",
      createdAt: todayISO(-2), channel: "NATIVE_APP"
    });
    state.fastPool.push({ id: uid("pool"), userId: id, score: 751, status: "WAITING", at: todayISO(-2) });
  }
  FAQ[0][2] = "You choose how much to save. That amount is pushed to the partner bank and stays there while you complete 12 monthly repayments. The bank, not this app, files the credit record.";
  FAQ[2][2] = "You do not add a new amount each month. The repayment is taken from the savings already at the bank. Autopay does it for you. You only watch the month turn green.";
  FAQ[3][2] = "The only fee you see is the activation fee, currently " + money(cfg().setupFee) + ". Super admin can change it. Anything else the bank charges sits inside the repayment and is not a separate bill in this app.";
  FAQ[4][2] = "At month 12 the bank releases the savings you put in. Platinum also opens the working-capital conversation with the bank. A perfect record is marked for a better rate. This app does not pay the loan out.";
  FAQ[5][2] = "Silver, Gold, and Platinum are goals. Silver opens a small MoMo cushion. Gold opens phone financing up to " + money(cfg().goldDevice) + ". Platinum is the finished ladder.";
}
function bumpScore(user, delta) {
  const now = score850(user) || 600;
  const next = Math.max(300, Math.min(850, now + delta));
  user.score850 = next;
  if (!user.scoreLog) user.scoreLog = [];
  user.scoreLog.push({ date: todayISO(0), score: next, delta: delta });
}

function openSavingsBox(fields) {
  const amount = Number(fields.amount);
  const c = cfg();
  if (amount < c.minSave || amount > c.maxSave) return fail("Choose a savings amount between " + money(c.minSave) + " and " + money(c.maxSave) + ".");
  const user = {
    id: uid("usr"), role: "CUSTOMER", pin: fields.pin, name: fields.name, phone: fields.phone,
    ghanaCard: fields.ghanaCard, provider: fields.provider || "MTN", momo: fields.momo || fields.phone,
    score: fields.score || 60, score850: fields.score850, scoreLog: [{ date: todayISO(0), score: fields.score850, delta: 0 }],
    consents: { scan: true, bureau: true, terms: true }, wallet: 0, track: "BUILDER",
    createdAt: todayISO(0), channel: fields.channel || "NATIVE_APP", agentId: fields.agentId || null,
    market: fields.market || ""
  };
  state.users.push(user);
  const loan = {
    id: uid("loan"), userId: user.id, principal: amount, savings: amount, locked: amount, contributed: 0,
    months: 0, maxMonths: c.termMonths, status: "ACTIVE", tier: "BRONZE", limit: 0, discount: 0,
    nextDue: addMonths(todayISO(0), 1), graceStart: null, openedAt: todayISO(0), groupId: null,
    offerStatus: "LOCKED", autopay: true, misses: 0, pushed: true
  };
  state.loans.push(loan);
  state.ledger.push({ id: uid("tx"), loanId: loan.id, userId: user.id, amount: amount, fee: 0, sweep: 0, type: "PUSHED_TO_BANK", channel: user.provider, status: "SUCCESS", date: todayISO(0), ref: "PUSH-" + loan.id.slice(-4) });
  if (c.setupFee > 0) {
    state.ledger.push({ id: uid("tx"), loanId: loan.id, userId: user.id, amount: c.setupFee, fee: c.setupFee, sweep: 0, type: "SETUP_FEE", channel: user.provider, status: "SUCCESS", date: todayISO(0), ref: "SETUP-" + loan.id.slice(-4) });
  }
  if (fields.agentId) {
    const agent = state.users.find(function (u) { return u.id === fields.agentId; });
    if (agent) {
      agent.commission = round2((agent.commission || 0) + c.agentCommission);
      agent.enrolled = (agent.enrolled || 0) + 1;
      audit("Agent " + agent.name + " enrolled " + user.name);
    }
  }
  notify(user.id, money(amount) + " is at " + c.bankName + ". Autopay will mark each month from that savings.");
  audit("Savings of " + amount + " pushed to the bank for " + user.name);
  return user;
}
function openFastTrack(fields) {
  const user = {
    id: uid("usr"), role: "CUSTOMER", pin: fields.pin, name: fields.name, phone: fields.phone,
    ghanaCard: fields.ghanaCard, provider: fields.provider || "MTN", momo: fields.momo || fields.phone,
    score: fields.score || 80, score850: fields.score850, scoreLog: [{ date: todayISO(0), score: fields.score850, delta: 0 }],
    consents: { scan: true, bureau: true, terms: true }, wallet: 0, track: "FAST",
    createdAt: todayISO(0), channel: fields.channel || "NATIVE_APP", agentId: fields.agentId || null
  };
  state.users.push(user);
  state.fastPool.push({ id: uid("pool"), userId: user.id, score: fields.score850, status: "WAITING", at: todayISO(0) });
  notify(user.id, "Your score cleared " + cfg().fastTrackScore + ". You skipped the savings box. Super admin will send your file to the bank.");
  audit("Fast-track pool: " + user.name + " score " + fields.score850);
  return user;
}

const _public = publicView;
publicView = function () {
  if (state.view === "login") return loginView();
  if (state.view === "signup") return signupView();
  if (state.view === "ussd" && !sessionUser()) return ussdView(null);
  return `<div class="phone-bar"><span>GH</span><span>${esc(cfg().ussdCode)}</span></div>
    <div class="phone-body">
      ${banners()}
      <p class="kicker">${esc(cfg().bankName)}</p>
      <h2>Pick what you save. The bank holds it.</h2>
      <div class="hero-box">
        <div class="small">You choose the amount</div>
        <div style="font-size:28px;font-weight:750;letter-spacing:-.04em">${money(cfg().minSave)} – ${money(cfg().maxSave)}</div>
        <p>Like a credit-builder lockbox. The full amount is pushed to the bank on day one. Each month is marked paid from that savings. Autopay is on. The bank files the credit record. We do not.</p>
      </div>
      <div class="choice-row">${SAVE_CHOICES.map(function (n) { return `<span class="choice">${money(n)}</span>`; }).join("")}</div>
      <button class="btn btn-block" data-go="signup">Start and choose an amount</button>
      <div style="height:8px"></div>
      <button class="btn-ghost btn-block" data-go="login">I already have a box</button>
      <div style="height:8px"></div>
      <button class="btn-ghost btn-block" data-go="ussd">USSD ${esc(cfg().ussdCode)}</button>
      <p class="footer-note">Activation fee ${money(cfg().setupFee)}, set by super admin. A score of ${cfg().fastTrackScore}+ skips the lockbox and waits in the bank pool.</p>
    </div>`;
};

signupView = function () {
  const s = state.signup;
  const step = s.step || 1;
  const bars = [1, 2, 3, 4, 5, 6].map(function (n) { return `<i class="${n <= step ? "on" : ""}"></i>`; }).join("");
  let body = "";
  if (step === 1) body = `
    <h2>Who is saving?</h2>
    <div class="field"><label>Full name</label><input id="su-name" value="${esc(s.name || "")}" placeholder="Ama Serwaa"></div>
    <div class="field"><label>Mobile number</label><input id="su-phone" value="${esc(s.phone || "")}" placeholder="0244XXXXXX"></div>
    <div class="field"><label>Ghana Card</label><input id="su-card" value="${esc(s.ghanaCard || "")}" placeholder="GHA-123456789-0"></div>
    <button class="btn btn-block" id="su-next">Continue</button>`;
  if (step === 2) body = `
    <h2>A clear yes</h2>
    <p class="hint">Data Protection Act, 2012 (Act 843). The scan is separate from the bank file. Say no and we stop.</p>
    <div class="notice">Activation fee ${money(cfg().setupFee)}. Charged once when a savings box opens. Super admin sets this number. Monthly bank charges stay inside the repayment. You will not see a second bill here.</div>
    <label class="toggle"><input type="checkbox" id="c-scan" ${s.scan ? "checked" : ""}><span>Scan phone behavior for a score. Not chats, passwords, or photos.</span></label>
    <label class="toggle"><input type="checkbox" id="c-terms" ${s.terms ? "checked" : ""}><span>I will choose a savings amount, it will be pushed to ${esc(cfg().bankName)}, and 12 months will be marked from that amount.</span></label>
    <button class="btn btn-block" id="su-scan">Agree and scan</button>
    <button class="btn-ghost btn-block" id="su-decline">No, stop signup</button>`;
  if (step === 3) body = `
    <h2>Your score</h2>
    <div class="gauge" style="--g:${Math.round(((s.score850 || 300) - 300) / 550 * 100)}"><b>${s.score850 || "…"}</b><span>${s.score850 ? scoreWord(s.score850) : ""}</span></div>
    <p class="hint">${s.score850 >= cfg().fastTrackScore ? "This score can skip the savings box and go straight to the bank pool." : "Below " + cfg().fastTrackScore + ". You will pick a savings amount and push it to the bank."}</p>
    <button class="btn btn-block" id="su-next" ${s.score850 == null ? "disabled" : ""}>Continue</button>`;
  if (step === 4 && s.fast) body = `
    <h2>Skip the lockbox</h2>
    <p class="hint">Score ${s.score850} clears ${cfg().fastTrackScore}. No savings amount. No activation fee. Super admin holds a list of people like you and sends that list to the bank when they are ready.</p>
    <button class="btn btn-block" id="su-next">Join the bank pool</button>
    <button class="btn-ghost btn-block" id="su-force-save">I still want to save an amount</button>`;
  if (step === 4 && !s.fast) body = `
    <h2>How much will you save?</h2>
    <p class="hint">The whole amount is pushed to the bank now. Twelve repayments are marked from it. Autopay stays on.</p>
    <div class="choice-row">${SAVE_CHOICES.map(function (n) { return `<button class="choice ${Number(s.amount) === n ? "on" : ""}" data-amt="${n}">${money(n)}</button>`; }).join("")}</div>
    <div class="field"><label>Or type an amount</label><input id="su-amount" inputmode="numeric" value="${esc(s.amount || "")}" placeholder="800"></div>
    <p class="hint">Each month the bank applies ${s.amount ? money(Math.round(Number(s.amount) / cfg().termMonths)) : "one twelfth"} from that savings. You will see the month tick, not a new charge.</p>
    <button class="btn btn-block" id="su-next">Push this amount to the bank</button>`;
  if (step === 5) body = `
    <h2>Where should receipts go?</h2>
    <div class="field"><label>Wallet</label><select id="su-provider">${Object.keys(cfg().providers).map(function (p) { return `<option ${s.provider === p ? "selected" : ""}>${esc(p)}</option>`; }).join("")}</select></div>
    <div class="field"><label>MoMo number</label><input id="su-momo" value="${esc(s.momo || s.phone || "")}"></div>
    <button class="btn btn-block" id="su-next">Continue</button>`;
  if (step === 6) body = `
    <h2>PIN</h2>
    <div class="field"><label>4-digit PIN</label><input id="su-pin" maxlength="4"></div>
    <div class="field"><label>Confirm PIN</label><input id="su-pin2" maxlength="4"></div>
    <button class="btn btn-block" id="su-finish">${s.fast ? "Join the bank pool" : "Push " + money(s.amount || 0) + " and open my box"}</button>`;
  return `<div class="phone-body">${banners()}<div class="steps">${bars}</div><p class="kicker">Step ${step} of 6</p>${body}
    <div style="height:8px"></div><button class="btn-ghost btn-block" data-go="welcome">Cancel</button></div>`;
};

signupNext = function () {
  const s = state.signup;
  if (!cfg().signupOpen) return fail("Signups are closed."), render();
  if (s.step === 1) {
    s.name = document.getElementById("su-name").value.trim();
    s.phone = document.getElementById("su-phone").value.trim();
    s.ghanaCard = document.getElementById("su-card").value.trim().toUpperCase();
    if (s.name.length < 3 || !/^0\d{9}$/.test(s.phone)) return fail("Use a full name and a 10-digit phone."), render();
    if (!/^GHA-\d{9}-\d$/.test(s.ghanaCard)) return fail("Ghana Card should look like GHA-123456789-0."), render();
    if (state.users.some(function (u) { return u.phone === s.phone || u.ghanaCard === s.ghanaCard; })) return fail("That phone or Ghana Card is already registered."), render();
    s.step = 2;
  } else if (s.step === 3) {
    s.fast = s.score850 >= cfg().fastTrackScore;
    s.step = 4;
  } else if (s.step === 4 && s.fast) {
    s.step = 5;
    s.provider = s.provider || "MTN";
    s.momo = s.phone;
  } else if (s.step === 4) {
    const typed = document.getElementById("su-amount") ? Number(document.getElementById("su-amount").value) : 0;
    s.amount = typed || Number(s.amount);
    if (s.amount < cfg().minSave || s.amount > cfg().maxSave) return fail("Amount must be between " + money(cfg().minSave) + " and " + money(cfg().maxSave) + "."), render();
    s.step = 5;
    s.provider = s.provider || "MTN";
    s.momo = s.phone;
  } else if (s.step === 5) {
    s.provider = document.getElementById("su-provider").value;
    s.momo = document.getElementById("su-momo").value.trim();
    s.step = 6;
  }
  state.error = "";
  render();
};

finishSignup = function () {
  const s = state.signup;
  const pin = document.getElementById("su-pin").value.trim();
  const pin2 = document.getElementById("su-pin2").value.trim();
  if (!/^\d{4}$/.test(pin) || pin !== pin2) return fail("PIN must be 4 digits and match."), render();
  const fields = { name: s.name, phone: s.phone, ghanaCard: s.ghanaCard, provider: s.provider, momo: s.momo, pin: pin, score: s.score, score850: s.score850, amount: s.amount, channel: "NATIVE_APP", agentId: s.agentId || null };
  const user = s.fast ? openFastTrack(fields) : openSavingsBox(fields);
  if (!user) return render();
  state.session = user.id;
  state.view = "home";
  state.signup = {};
  flash(s.fast ? "You are in the bank pool. No lockbox was opened." : money(s.amount) + " was pushed to " + cfg().bankName + ".");
  render();
};

function monthGrid(loan) {
  const names = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  return `<div class="months">${names.map(function (label, i) {
    const done = loan && loan.months > i;
    const now = loan && loan.months === i && (loan.status === "ACTIVE" || loan.status === "GRACE");
    return `<div class="mo ${done ? "done" : ""} ${now ? "now" : ""}"><b>${done ? "✓" : label}</b><span>M${label}</span></div>`;
  }).join("")}</div>`;
}
function ladderCards(loan) {
  const rank = { BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 }[loan.tier] || 0;
  const items = [
    ["Bronze", "Start", "Savings sit at the bank. Twelve months to go.", true],
    ["Silver", "Month " + cfg().silverMonth, "MoMo cushion of " + money(cfg().silverCushion) + " unlocks.", rank >= 1],
    ["Gold", "Month " + cfg().goldMonth, "Phone financing up to " + money(cfg().goldDevice) + ".", rank >= 2],
    ["Platinum", "Month 12", "Savings released. Bank sees a finished record" + (loan.misses ? "." : " and a perfect-history mark."), rank >= 3]
  ];
  return `<div class="ladder-cards">${items.map(function (it) {
    return `<div class="unlock ${it[3] ? "on" : ""}"><b>${it[0]}</b><div class="small">${it[1]}</div><p class="hint">${it[2]}</p></div>`;
  }).join("")}</div>`;
}

homeView = function (user, loan) {
  if (user.track === "FAST") return fastHome(user);
  if (!loan) return `<h2>No savings box</h2><button class="btn" data-go="signup">Choose an amount</button>`;
  const tab = state.boxTab || "progress";
  const due = monthDue(loan);
  return `${banners()}
    <div class="tabs"><button class="chip ${tab === "progress" ? "on" : ""}" id="tab-progress">Progress</button><button class="chip ${tab === "score" ? "on" : ""}" id="tab-score">Score</button></div>
    ${tab === "score" ? scorePanel(user, loan) : progressPanel(user, loan, due)}`;
};
function progressPanel(user, loan, due) {
  return `<p class="kicker">Credit builder</p>
    <div class="split"><h2>${loan.months} of ${loan.maxMonths}</h2><span class="badge b-${loan.tier.toLowerCase()}">${esc(loan.tier)}</span></div>
    ${monthGrid(loan)}
    <div class="card" style="margin-top:12px"><b>Autopay ${loan.autopay ? "on" : "off"}</b>
      <p class="hint">Next month ${esc(loan.nextDue || "done")} · ${money(due)} from the ${money(loan.savings)} already at the bank.</p>
      <button class="btn-ghost" id="toggle-autopay">${loan.autopay ? "Turn autopay off" : "Turn autopay on"}</button>
      <button class="btn" id="open-pay" ${loan.status === "ACTIVE" || loan.status === "GRACE" ? "" : "disabled"}>Pay</button>
    </div>
    ${state.paySheet ? paySheet(user, loan, due) : ""}
    <h3>Activity</h3>
    <div class="card"><b>Amount pushed to the bank</b><p class="hint">${money(loan.savings)} on ${esc(loan.openedAt)}. Activation fee ${money(cfg().setupFee)} was separate.</p></div>
    ${loan.months ? `<div class="card"><b>Repayment recorded</b><p class="hint">Month ${loan.months} is done. Keep going.</p></div>` : ""}
    ${ladderCards(loan)}
    <button class="btn-ghost btn-block" data-go="tiers">Open the ladder</button>`;
}
function paySheet(user, loan, due) {
  return `<div class="sheet">
    <h3>Make a repayment</h3>
    <p class="hint">Due ${esc(loan.nextDue || "now")}</p>
    <div class="pay-amt">${money(due)}</div>
    <p class="hint">From savings already at ${esc(cfg().bankName)}: ${money(loan.locked)}</p>
    <p class="footer-note">Paying marks this month done. The money does not leave your MoMo again. The bank uses this line when they file.</p>
    <button class="btn btn-block" id="do-pay">Pay</button>
    <button class="btn-ghost btn-block" id="close-pay">Close</button>
  </div>`;
}
function scorePanel(user, loan) {
  const s = score850(user);
  const log = (user.scoreLog || []).slice().reverse();
  const onTime = loan.maxMonths ? Math.round((loan.months / Math.max(loan.months + loan.misses, 1)) * 100) : 0;
  return `<p class="kicker">Score</p>
    <div class="gauge" style="--g:${Math.round(((s || 300) - 300) / 550 * 100)}"><b>${s || "—"}</b><span>${s ? scoreWord(s) : ""}</span></div>
    <p class="hint">Updated ${esc((log[0] && log[0].date) || "today")}. This is your builder score in the app. The bank decides what gets filed.</p>
    <h3>Score history</h3>
    <div class="list">${log.slice(0, state.showScores ? 24 : 4).map(function (row) {
      return `<div class="row-card"><div><b>${esc(row.date)}</b><div class="small ${row.delta > 0 ? "up" : "muted"}">${row.delta ? (row.delta > 0 ? "+" : "") + row.delta + " pts" : "No change"}</div></div><b>${row.score}</b></div>`;
    }).join("") || `<p class="hint">No history yet.</p>`}</div>
    <button class="btn-ghost btn-block" id="show-scores">${state.showScores ? "Show less" : "Show all"}</button>
    <h3>What moves it</h3>
    <div class="row-card"><div><b>Repayments on time</b><div class="small muted">${onTime}% of months so far</div></div><b>${loan.months}</b></div>
    <div class="row-card"><div><b>Age of this box</b><div class="small muted">Opened ${esc(loan.openedAt)}</div></div><b>${loan.months} mo</b></div>`;
}
function fastHome(user) {
  const row = state.fastPool.find(function (p) { return p.userId === user.id; });
  return `${banners()}<p class="kicker">Bank pool</p><h2>No lockbox</h2>
    <div class="gauge" style="--g:${Math.round(((score850(user) || 300) - 300) / 550 * 100)}"><b>${score850(user)}</b><span>${scoreWord(score850(user))}</span></div>
    <div class="notice">Score is ${cfg().fastTrackScore} or higher, so you skipped the savings amount. Status: ${esc(row ? row.status : "WAITING")}. Super admin sends this list to the bank. You do not pick a savings amount unless you ask to.</div>
    <button class="btn-ghost btn-block" data-go="signup">Choose a savings amount anyway</button>`;
}

boxView = function (user, loan) {
  if (user.track === "FAST") return fastHome(user);
  if (!loan) return `<h2>No box</h2>`;
  return `${banners()}<p class="kicker">At the bank</p><h2>${money(loan.locked)}</h2>
    <p class="hint">Pushed on ${esc(loan.openedAt)}. Still yours. Released when the 12 months are done, or if the box is closed early.</p>
    ${monthGrid(loan)}
    <div class="row-card"><span>Monthly repayment</span><b>${money(monthDue(loan))}</b></div>
    <div class="row-card"><span>Months done</span><b>${loan.months}/${loan.maxMonths}</b></div>
    <button class="btn-ghost btn-block" data-go="history">Repayment list</button>`;
};

payView = function (user, loan) {
  if (!loan || user.track === "FAST") return `<h2>Nothing to pay</h2><p class="hint">Fast-track customers are not on a savings repayment.</p>`;
  state.paySheet = true;
  return homeView(user, loan);
};

tiersView = function (user, loan) {
  if (!loan) return fastHome(user);
  const silver = ["SILVER", "GOLD", "PLATINUM"].indexOf(loan.tier) >= 0;
  const gold = ["GOLD", "PLATINUM"].indexOf(loan.tier) >= 0;
  const mineC = state.cushions.filter(function (c) { return c.userId === user.id; });
  const mineD = state.devices.filter(function (d) { return d.userId === user.id; });
  return `${banners()}<p class="kicker">The goal</p><h2>${esc(loan.tier)}</h2>
    ${ladderCards(loan)}
    <h3>Silver unlock</h3>
    <p class="hint">A ${money(cfg().silverCushion)} MoMo cushion for a slow market week. The bank funds it. This app only asks.</p>
    ${mineC.map(function (c) { return `<div class="row-card"><span>Cushion</span><b>${esc(c.status)}</b></div>`; }).join("")}
    <button class="btn btn-block" id="ask-cushion" ${silver && !mineC.length ? "" : "disabled"}>${silver ? "Ask for the cushion" : "Reach Silver first"}</button>
    <h3>Gold unlock</h3>
    <p class="hint">Phone financing up to ${money(cfg().goldDevice)}. Pick one. The bank decides the terms.</p>
    ${DEVICES.map(function (d) {
      return `<div class="row-card"><div><b>${esc(d.name)}</b><div class="small muted">${money(d.price)}</div></div><button class="chip" data-device="${d.id}" ${gold && d.price <= cfg().goldDevice ? "" : "disabled"}>Ask</button></div>`;
    }).join("")}
    ${mineD.map(function (d) { return `<p class="hint">${esc(d.name)} · ${esc(d.status)}</p>`; }).join("")}
    <h3>Platinum</h3>
    <p class="hint">${loan.misses ? "A missed month is on the file, so the perfect-history mark stays off." : "No missed month. Platinum will carry a perfect-history mark for the bank, worth a better rate on their side."}</p>
    <button class="btn-ghost btn-block" data-go="offer" ${loan.status === "MATURED_SUCCESS" ? "" : "disabled"}>Savings released · talk to the bank</button>`;
};

creditView = function (user) {
  const loan = loanOf(user.id);
  const rows = state.ledger.filter(function (t) { return t.userId === user.id && (t.type === "REPAYMENT" || t.type === "CO_PAYMENT" || t.type === "PUSHED_TO_BANK"); });
  return `${banners()}<p class="kicker">For the bank</p><h2>Your record</h2>
    <p class="hint">We do not file to a bureau. This is the pack the bank uses when they do.</p>
    <div class="row-card"><span>Savings pushed</span><b>${loan ? money(loan.savings || loan.locked) : "—"}</b></div>
    <div class="row-card"><span>Months marked</span><b>${loan ? loan.months : 0}</b></div>
    <div class="row-card"><span>Misses</span><b>${loan ? loan.misses : 0}</b></div>
    <div class="list" style="margin-top:8px">${rows.slice().reverse().map(function (t) {
      return `<div class="row-card"><div><b>${esc(t.type.replaceAll("_", " "))}</b><div class="small muted">${esc(t.date)}</div></div><span>${money(t.amount)}</span></div>`;
    }).join("")}</div>`;
};

offerView = function (user, loan) {
  if (!loan) return `<h2>No box</h2>`;
  const perfect = !loan.misses;
  return `${banners()}<p class="kicker">Month 12</p><h2>Savings back</h2>
    <div class="hero-box"><div class="small">Released to you</div><div style="font-size:28px;font-weight:750">${money(loan.savings || loan.contributed)}</div>
    <p>${perfect ? "Perfect history. The bank report asks for a better rate on anything they offer next." : "The bank gets the month-by-month record, including the miss."} This app does not disburse a loan.</p></div>
    <button class="btn btn-block" id="take-offer" ${loan.offerStatus === "AVAILABLE" ? "" : "disabled"}>Tell the bank I am ready</button>`;
};

function poolAdmin() {
  const rows = state.fastPool.map(function (p) {
    const u = state.users.find(function (x) { return x.id === p.userId; });
    return `<tr><td>${esc(u ? u.name : "?")}</td><td>${esc(u ? u.phone : "")}</td><td>${p.score}</td><td>${esc(p.status)}</td><td>${p.status === "WAITING" ? `<button class="chip" data-send-pool="${p.id}">Send</button>` : esc(p.sentAt || "")}</td></tr>`;
  }).join("");
  return `<h2>Fast-track pool</h2>
    <p class="hint">Scores of ${cfg().fastTrackScore} and above skip the savings box. They sit here until you send them to the bank. The bank takes it from there.</p>
    <table><tr><th>Name</th><th>Phone</th><th>Score</th><th>Status</th><th></th></tr>${rows || `<tr><td colspan="5">Nobody waiting.</td></tr>`}</table>
    <button class="btn" id="send-pool-all">Send everyone waiting</button>
    <div class="field" style="margin-top:12px"><label>Fast-track score</label><input id="cfg-fast" type="number" value="${cfg().fastTrackScore}"></div>
    <button class="btn-ghost" id="save-fast">Save score gate</button>`;
}
function reportAdmin() {
  const lines = bankReportRows();
  return `<h2>Report for the bank</h2>
    <p class="hint">Filing to a bureau is the bank's job. This is the pack we hand them: who saved, how much was pushed, which months are done, who is in the fast-track pool.</p>
    <table><tr><th>Name</th><th>Path</th><th>Saved</th><th>Months</th><th>Misses</th><th>Score</th></tr>
      ${lines.map(function (r) { return `<tr><td>${esc(r.name)}</td><td>${esc(r.path)}</td><td>${money(r.saved)}</td><td>${r.months}</td><td>${r.misses}</td><td>${r.score}</td></tr>`; }).join("")}
    </table>
    <button class="btn" id="download-report">Download the pack</button>
    <p class="hint">Activation fee on new boxes: ${money(cfg().setupFee)}. Change it under Product controls. It is the only fee the customer sees.</p>`;
}
function bankReportRows() {
  return state.users.filter(function (u) { return u.role === "CUSTOMER"; }).map(function (u) {
    const loan = loanOf(u.id);
    const pool = state.fastPool.find(function (p) { return p.userId === u.id; });
    return {
      name: u.name, phone: u.phone, ghanaCard: u.ghanaCard, path: u.track === "FAST" ? "FAST_TRACK" : "SAVINGS",
      saved: loan ? loan.savings || 0 : 0, months: loan ? loan.months : 0, misses: loan ? loan.misses || 0 : 0,
      score: score850(u) || "", tier: loan ? loan.tier : "", pool: pool ? pool.status : "",
      autopay: loan ? loan.autopay : "", agent: u.agentId || ""
    };
  });
}
function agentsAdmin() {
  const agents = state.users.filter(function (u) { return u.role === "AGENT"; });
  return `<h2>Susu collectors</h2>
    <p class="hint">They register people in the markets. Each active box pays them ${money(cfg().agentCommission)}, set here.</p>
    <div class="field"><label>Commission per enrollment</label><input id="cfg-comm" type="number" value="${cfg().agentCommission}"></div>
    <button class="btn-ghost" id="save-comm">Save commission</button>
    <table><tr><th>Name</th><th>Market</th><th>Login</th><th>Enrolled</th><th>Earned</th></tr>
      ${agents.map(function (a) { return `<tr><td>${esc(a.name)}</td><td>${esc(a.market || "")}</td><td>${esc(a.username)}</td><td>${a.enrolled || 0}</td><td>${money(a.commission || 0)}</td></tr>`; }).join("")}
    </table>`;
}

const _adminViewB = adminView;
adminView = function (user) {
  if (state.adminView === "pool") return user.role === "SUPER" ? poolAdmin() : `<h2>Super admin only</h2>`;
  if (state.adminView === "report") return reportAdmin();
  if (state.adminView === "agents") return user.role === "SUPER" || user.role === "OPS" ? agentsAdmin() : `<h2>Not your desk</h2>`;
  return _adminViewB(user);
};
const _adminShellB = adminShell;
adminShell = function (user) {
  return _adminShellB(user).replace(
    '<button class="btn-ghost btn-block" data-logout="1">Log out</button>',
    '<button class="chip" data-admin="pool">Fast-track pool</button><button class="chip" data-admin="report">Bank report</button><button class="chip" data-admin="agents">Agents</button><button class="btn-ghost btn-block" data-logout="1">Log out</button>'
  );
};

function agentPage(agent) {
  const mine = state.users.filter(function (u) { return u.agentId === agent.id; });
  return `<div class="app-shell"><div class="topbar"><div class="brand"><div class="mark"><span>₵</span></div><div><h1>Collector</h1><p>${esc(agent.market || "Market")} · ${esc(agent.name)}</p></div></div>
    <div class="demo-switch"><button class="chip" data-jump="customer">Customer</button><button class="chip" data-jump="super">Super admin</button><button class="btn-ghost" data-logout="1">Log out</button></div></div>
    <section class="wide">${banners()}
      <div class="kpi-grid">
        <div class="stat"><span>Enrolled</span><b>${agent.enrolled || mine.length}</b></div>
        <div class="stat"><span>Commission</span><b>${money(agent.commission || 0)}</b></div>
        <div class="stat"><span>Per person</span><b>${money(cfg().agentCommission)}</b></div>
        <div class="stat"><span>Market</span><b>${esc(agent.market || "—")}</b></div>
      </div>
      <h2>Register someone in the market</h2>
      <div class="grid-2">
        <div class="field"><label>Name</label><input id="ag-name" placeholder="Efua Boateng"></div>
        <div class="field"><label>Phone</label><input id="ag-phone" placeholder="0244XXXXXX"></div>
        <div class="field"><label>Ghana Card</label><input id="ag-card" placeholder="GHA-123456789-0"></div>
        <div class="field"><label>Savings they chose</label><input id="ag-amt" inputmode="numeric" placeholder="600"></div>
        <div class="field"><label>PIN you agree with them</label><input id="ag-pin" maxlength="4" placeholder="1234"></div>
        <div class="field"><label>Wallet</label><select id="ag-prov"><option>MTN</option><option>Telecel</option><option>AT Money</option></select></div>
      </div>
      <button class="btn" id="ag-save">Push their savings and enroll</button>
      <h3>People you enrolled</h3>
      <table><tr><th>Name</th><th>Phone</th><th>Saved</th><th>Months</th></tr>
        ${mine.map(function (u) { const l = loanOf(u.id); return `<tr><td>${esc(u.name)}</td><td>${esc(u.phone)}</td><td>${l ? money(l.savings) : u.track || ""}</td><td>${l ? l.months : "—"}</td></tr>`; }).join("") || `<tr><td colspan="4">None yet.</td></tr>`}
      </table>
      <p class="hint">You can also enroll on USSD ${esc(cfg().ussdCode)}. Feature phones skip the metadata scan and stay on the savings path.</p>
    </section></div>`;
}

ussdView = function (user) {
  const u = state.ussd;
  const screen = u.screen || "home";
  const loan = user ? loanOf(user.id) : null;
  const lines = {
    home: `${cfg().ussdCode}\n${cfg().productName}\n1 Register and save\n2 Mark this month paid\n3 My progress\n0 Exit`,
    "reg-phone": `Enter phone\n10 digits\nthen #`,
    "reg-name": `Enter name\nthen #`,
    "reg-card": `Ghana Card\nGHA-123456789-0\nthen #`,
    "reg-amt": `How much to save?\n1 ${SAVE_CHOICES[0]}\n2 ${SAVE_CHOICES[1]}\n3 ${SAVE_CHOICES[2]}\n4 ${SAVE_CHOICES[3]}\n5 ${SAVE_CHOICES[4]}`,
    "reg-pin": `Choose a 4 digit PIN\nthen #`,
    progress: loan ? `Saved ${money(loan.savings)}\nDone ${loan.months}/12\nNext ${loan.nextDue || "done"}\n1 Back` : `No box on this phone.\n1 Register\n0 Back`,
    done: u.note || "Done\n0 Home"
  };
  return `${banners()}<p class="kicker">Feature phone</p><h2>USSD ${esc(cfg().ussdCode)}</h2>
    <div class="ussd">${esc(lines[screen] || lines.home)}</div>
    <div class="field"><label>Type a line, then send</label><input id="ussd-text" placeholder="name, phone, or PIN"></div>
    <button class="btn btn-block" id="ussd-send">Send</button>
    <div class="ussd-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map(function (k) { return `<button data-ussd="${k}">${k}</button>`; }).join("")}</div>
    <p class="footer-note">Registration on a feature phone uses a starter score under ${cfg().fastTrackScore}, so it always opens a savings box. The amount is pushed to the bank.</p>`;
};

ussdPress = function (key) {
  const u = state.ussd;
  if (!u.screen) u.screen = "home";
  if (key === "#") return ussdSend();
  if (u.screen === "home") {
    if (key === "1") u.screen = "reg-phone";
    if (key === "2") {
      const user = sessionUser();
      const loan = user && loanOf(user.id);
      if (!loan) u.screen = "progress";
      else { postPayment(user, loan, "USSD_385"); u.note = "Month marked paid."; u.screen = "done"; }
    }
    if (key === "3") u.screen = "progress";
    if (key === "0") { state.view = sessionUser() ? "more" : "welcome"; u.screen = "home"; }
  } else if (u.screen === "reg-amt" && "12345".indexOf(key) >= 0) {
    u.amount = SAVE_CHOICES[Number(key) - 1];
    u.screen = "reg-pin";
  } else if (u.screen === "progress" && key === "1") u.screen = "reg-phone";
  else if (key === "0") u.screen = "home";
  render();
};
function ussdSend() {
  const u = state.ussd;
  const text = (document.getElementById("ussd-text") || {}).value || "";
  const value = text.trim();
  if (u.screen === "reg-phone") {
    if (!/^0\d{9}$/.test(value)) return fail("10-digit phone."), render();
    u.phone = value;
    u.screen = "reg-name";
  } else if (u.screen === "reg-name") {
    if (value.length < 3) return fail("Enter a name."), render();
    u.name = value;
    u.screen = "reg-card";
  } else if (u.screen === "reg-card") {
    if (!/^GHA-\d{9}-\d$/.test(value.toUpperCase())) return fail("Card looks wrong."), render();
    u.ghanaCard = value.toUpperCase();
    u.screen = "reg-amt";
  } else if (u.screen === "reg-pin") {
    if (!/^\d{4}$/.test(value)) return fail("4 digit PIN."), render();
    if (state.users.some(function (x) { return x.phone === u.phone; })) return fail("Phone already registered."), render();
    const user = openSavingsBox({
      name: u.name, phone: u.phone, ghanaCard: u.ghanaCard, amount: u.amount, pin: value,
      score: 62, score850: 640, provider: "MTN", channel: "USSD_385"
    });
    if (!user) return render();
    state.session = user.id;
    u.note = "Box open. " + money(u.amount) + " pushed to the bank.";
    u.screen = "done";
  }
  state.error = "";
  render();
}

postPayment = function (user, loan, channel) {
  if (!loan || user.track === "FAST") return fail("No savings repayment on a fast-track file.");
  if (loan.status !== "ACTIVE" && loan.status !== "GRACE") return fail("This box is not taking a repayment.");
  const ref = "PAY-" + loan.id.slice(-4) + "-" + (loan.months + 1);
  if (state.ledger.some(function (t) { return t.ref === ref; })) return fail("That month is already marked.");
  const due = monthDue(loan);
  loan.months += 1;
  loan.misses = loan.misses || 0;
  loan.status = loan.months >= loan.maxMonths ? "MATURED_SUCCESS" : "ACTIVE";
  loan.graceStart = null;
  if (loan.status === "MATURED_SUCCESS") {
    user.wallet = round2(user.wallet + loan.locked);
    loan.contributed = loan.savings;
    loan.locked = 0;
    loan.offerStatus = "AVAILABLE";
    loan.perfect = !loan.misses;
    notify(user.id, "Twelve months done. " + money(loan.savings) + " is back with you.");
  } else {
    loan.nextDue = addMonths(todayISO(0), 1);
    notify(user.id, "Month " + loan.months + " marked paid from the savings at the bank.");
  }
  applyTier(loan);
  if (loan.perfect) loan.discount = cfg().platinumDiscount || 25;
  bumpScore(user, 4);
  state.ledger.push({ id: uid("tx"), loanId: loan.id, userId: user.id, amount: due, fee: 0, sweep: 0, type: "REPAYMENT", channel: channel, status: "SUCCESS", date: todayISO(0), ref: ref });
  audit("Repayment month " + loan.months + " for " + user.name + " via " + channel);
  flash(loan.status === "MATURED_SUCCESS" ? "Ladder complete. Savings released." : "Month " + loan.months + " is done.");
  state.paySheet = false;
};

billingDay = function () {
  let n = 0;
  state.loans.forEach(function (loan) {
    if (loan.status !== "ACTIVE" && loan.status !== "GRACE") return;
    if (loan.nextDue && loan.nextDue > todayISO(0)) return;
    const user = state.users.find(function (u) { return u.id === loan.userId; });
    if (loan.autopay) {
      postPayment(user, loan, "AUTOPAY");
      n++;
    } else if (loan.status === "ACTIVE") {
      loan.status = "GRACE";
      loan.graceStart = todayISO(0);
      loan.misses = (loan.misses || 0) + 1;
      bumpScore(user, -6);
      notify(user.id, "Autopay is off and the month was not marked. Grace is open.");
      n++;
    } else if (loan.graceStart && daysBetween(loan.graceStart, todayISO(0)) > cfg().graceDays) {
      setOff(loan, "Grace ended");
      n++;
    }
  });
  audit("Billing day marked " + n + " accounts");
  flash("Billing day touched " + n + " accounts.");
};

const _jumpB = jump;
jump = function (role) {
  if (role === "agent") {
    const user = state.users.find(function (u) { return u.username === "agent.makola"; });
    state.session = user.id;
    state.forceBank = false;
    state.view = "home";
    state.flash = "";
    render();
    return;
  }
  _jumpB(role);
};

const _renderB = render;
render = function () {
  ensureBuilder();
  const user = sessionUser();
  if (user && user.role === "AGENT" && !state.forceBank) {
    document.getElementById("app").innerHTML = agentPage(user);
    bind();
    bindBuilder();
    save();
    return;
  }
  _renderB();
  const bar = document.querySelector(".demo-switch");
  if (bar && !bar.querySelector("[data-jump='agent']")) {
    const b = document.createElement("button");
    b.className = "chip" + (user && user.role === "AGENT" ? " on" : "");
    b.textContent = "Agent";
    b.setAttribute("data-jump", "agent");
    b.onclick = function () { jump("agent"); };
    const bankBtn = bar.querySelector("[data-jump='bank']");
    bar.insertBefore(b, bankBtn || bar.lastElementChild);
  }
};

function bindBuilder() {
  document.querySelectorAll("[data-amt]").forEach(function (el) {
    el.onclick = function () {
      state.signup.amount = Number(el.dataset.amt);
      const input = document.getElementById("su-amount");
      if (input) input.value = el.dataset.amt;
      render();
    };
  });
  const decline = document.getElementById("su-decline");
  if (decline) decline.onclick = function () {
    state.signup = { step: 1 };
    state.view = "welcome";
    flash("Signup stopped. Nothing was saved.");
    render();
  };
  const force = document.getElementById("su-force-save");
  if (force) force.onclick = function () { state.signup.fast = false; render(); };
  const tabP = document.getElementById("tab-progress");
  if (tabP) tabP.onclick = function () { state.boxTab = "progress"; render(); };
  const tabS = document.getElementById("tab-score");
  if (tabS) tabS.onclick = function () { state.boxTab = "score"; render(); };
  const show = document.getElementById("show-scores");
  if (show) show.onclick = function () { state.showScores = !state.showScores; render(); };
  const auto = document.getElementById("toggle-autopay");
  if (auto) auto.onclick = function () {
    const loan = loanOf(sessionUser().id);
    loan.autopay = !loan.autopay;
    flash(loan.autopay ? "Autopay is on. Months mark themselves from the bank savings." : "Autopay is off. You have to tap Pay.");
    render();
  };
  const openPay = document.getElementById("open-pay");
  if (openPay) openPay.onclick = function () { state.paySheet = true; render(); };
  const closePay = document.getElementById("close-pay");
  if (closePay) closePay.onclick = function () { state.paySheet = false; state.view = "home"; render(); };
  const cushion = document.getElementById("ask-cushion");
  if (cushion) cushion.onclick = function () {
    state.cushions.push({ id: uid("csh"), userId: sessionUser().id, amount: cfg().silverCushion, status: "ASKED", at: todayISO(0) });
    flash("Cushion request is with the bank.");
    render();
  };
  document.querySelectorAll("[data-device]").forEach(function (el) {
    el.onclick = function () {
      const d = DEVICES.find(function (x) { return x.id === el.dataset.device; });
      state.devices.push({ id: uid("dev"), userId: sessionUser().id, name: d.name, price: d.price, status: "ASKED", at: todayISO(0) });
      flash(d.name + " request is with the bank.");
      render();
    };
  });
  const sendAll = document.getElementById("send-pool-all");
  if (sendAll) sendAll.onclick = function () { sendPool(null); };
  document.querySelectorAll("[data-send-pool]").forEach(function (el) {
    el.onclick = function () { sendPool(el.dataset.sendPool); };
  });
  const saveFast = document.getElementById("save-fast");
  if (saveFast) saveFast.onclick = function () {
    cfg().fastTrackScore = Number(document.getElementById("cfg-fast").value);
    audit("Fast-track score set to " + cfg().fastTrackScore);
    flash("Score gate saved.");
    render();
  };
  const saveComm = document.getElementById("save-comm");
  if (saveComm) saveComm.onclick = function () {
    cfg().agentCommission = Number(document.getElementById("cfg-comm").value);
    flash("Commission saved.");
    render();
  };
  const dl = document.getElementById("download-report");
  if (dl) dl.onclick = function () {
    const rows = bankReportRows();
    const header = "name,phone,ghanaCard,path,saved,months,misses,score,tier,pool,autopay\n";
    const body = rows.map(function (r) { return [r.name, r.phone, r.ghanaCard, r.path, r.saved, r.months, r.misses, r.score, r.tier, r.pool, r.autopay].join(","); }).join("\n");
    state.bankReports.push({ id: uid("rpt"), at: todayISO(0), rows: rows.length });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    a.download = "bank-builder-report.csv";
    a.click();
    audit("Bank report downloaded");
    flash("Report downloaded. The bank files it. We do not.");
  };
  const ag = document.getElementById("ag-save");
  if (ag) ag.onclick = function () {
    const agent = sessionUser();
    const phone = document.getElementById("ag-phone").value.trim();
    const card = document.getElementById("ag-card").value.trim().toUpperCase();
    const name = document.getElementById("ag-name").value.trim();
    const amount = Number(document.getElementById("ag-amt").value);
    const pin = document.getElementById("ag-pin").value.trim();
    if (name.length < 3 || !/^0\d{9}$/.test(phone) || !/^GHA-\d{9}-\d$/.test(card) || !/^\d{4}$/.test(pin)) return fail("Check name, phone, Ghana Card, and PIN."), render();
    if (state.users.some(function (u) { return u.phone === phone; })) return fail("That phone is already registered."), render();
    const user = openSavingsBox({
      name: name, phone: phone, ghanaCard: card, amount: amount, pin: pin, provider: document.getElementById("ag-prov").value,
      score: 64, score850: 652, channel: "AGENT", agentId: agent.id, market: agent.market
    });
    if (!user) return render();
    flash(name + " enrolled. " + money(amount) + " pushed to the bank. You earned " + money(cfg().agentCommission) + ".");
    render();
  };
  const sendU = document.getElementById("ussd-send");
  if (sendU) sendU.onclick = ussdSend;
}
function sendPool(id) {
  let n = 0;
  state.fastPool.forEach(function (p) {
    if (p.status !== "WAITING") return;
    if (id && p.id !== id) return;
    p.status = "SENT";
    p.sentAt = todayISO(0);
    const u = state.users.find(function (x) { return x.id === p.userId; });
    if (u) notify(u.id, "Your file was sent to " + cfg().bankName + ".");
    n++;
  });
  audit("Fast-track pool sent (" + n + ")");
  flash(n + " file" + (n === 1 ? "" : "s") + " sent to the bank.");
  render();
}

const _bindB = bind;
bind = function () {
  _bindB();
  const scan = document.getElementById("su-scan");
  if (scan) scan.onclick = function () {
    state.signup.scan = document.getElementById("c-scan").checked;
    state.signup.terms = document.getElementById("c-terms").checked;
    if (!state.signup.scan || !state.signup.terms) return fail("Both answers are required, or stop signup."), render();
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
  bindBuilder();
};

const _bankHomeB = bankHome;
bankHome = function () {
  const waiting = state.fastPool.filter(function (p) { return p.status === "WAITING"; }).length;
  const sent = state.fastPool.filter(function (p) { return p.status === "SENT"; }).length;
  return _bankHomeB() + `<div class="notice">Builder report is produced by the app. Bureau filing stays with the bank. Fast-track files waiting ${waiting}, already sent ${sent}. Treasury bills stay on your desk, not in this app.</div>`;
};

const _loginB = loginView;
loginView = function () {
  return _loginB().replace("Bank portal", "Agent agent.makola / 5555. Fast-track Kojo 0244777007 / 1234. Bank portal");
};

render();
