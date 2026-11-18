// --- SUPABASE VERBINDUNG (Ohne CDN, direkt über fetch) ---
const supabaseUrl = "https://loyxqwxuicyilyciekzh.supabase.co";
const supabaseKey = "sb_publishable_m-LXnPrRFZaAsXo_U5Zv_w_OO13GIZH";

function getSession() {
  try {
    return JSON.parse(localStorage.getItem("sb_session"));
  } catch (e) {
    return null;
  }
}

function getHeaders(extra = {}) {
  const session = getSession();
  const token = session?.access_token || supabaseKey;
  return {
    "apikey": supabaseKey,
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra
  };
}

// --- DOM ELEMENTE ---
const coinsDisplay = document.getElementById("coins");
const historyList = document.getElementById("history");
const qrBox = document.getElementById("qr-box");

// --- USER DATEN ---
let currentUser = null;

// --- AUTO-LOGOUT NACH 5 MIN ---
setTimeout(async () => {
  const session = getSession();
  if (session?.access_token) {
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: getHeaders()
    }).catch(() => {});
  }
  localStorage.removeItem("sb_session");
  window.location.replace("login.html");
}, 5 * 60 * 1000);

// --- AUTOMATISCHEN GUTSCHEIN ERSTELLEN ---
async function checkRewards() {
  if (!currentUser) return;

  // Nur wenn User genug Coins hat
  if (currentUser.coins < 100) return;

  // Prüfen, ob User schon einen Apfel-Gutschein hat
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rewards?select=*&user_id=eq.${encodeURIComponent(currentUser.auth_id)}&reward_name=eq.${encodeURIComponent("Gratis Apfel")}&redeemed=eq.false`,
    { headers: getHeaders() }
  );
  const existing = res.ok ? await res.json() : [];

  if (existing && existing.length > 0) {
    return; // Gutschein existiert bereits
  }

  // Gutschein erzeugen
  await fetch(`${supabaseUrl}/rest/v1/rewards`, {
    method: "POST",
    headers: getHeaders({ "Prefer": "return=minimal" }),
    body: JSON.stringify({
      user_id: currentUser.auth_id,
      reward_name: "Gratis Apfel",
      cost: 100,
      redeemed: false
    })
  });

  console.log("Gutschein erstellt: Gratis Apfel");
}

// --- QR-CODE GENERIEREN ---
function renderQRCode(qrText) {
  const qrBox = document.getElementById("qr-box");

  if (!qrBox) {
    console.error("qr-box nicht gefunden");
    return;
  }

  if (!qrText || qrText.trim() === "") {
    console.error("QR-Code leer");
    return;
  }

  qrBox.innerHTML = "";

  new QRCode(qrBox, {
    text: qrText,
    width: 120,
    height: 120,
    colorDark: "#2e7d32",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function renderProfile() {
  const profileName = document.getElementById("profile-name");

  if (profileName) {
    profileName.innerText = currentUser.name;
  }
}

async function loadRewards() {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/rewards?select=*&user_id=eq.${encodeURIComponent(currentUser.auth_id)}&redeemed=eq.false`,
    { headers: getHeaders() }
  );
  const data = res.ok ? await res.json() : [];

  const box = document.getElementById("rewards-box");
  box.innerHTML = "";

  if (!data || data.length === 0) {
    box.innerText = "Keine Gutscheine vorhanden.";
    return;
  }

  data.forEach(r => {
    const div = document.createElement("div");
    div.innerText = `${r.reward_name} (Kosten: ${r.cost})`;
    box.appendChild(div);
  });
}

console.log("SCRIPT STARTET");

// --- USER LADEN ---
async function loadUser() {
  const session = getSession();

  if (!session || !session.access_token) {
    window.location.replace("login.html");
    return;
  }

  // Aktuellen Auth-User bei Supabase prüfen
  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: getHeaders()
  });

  if (!authRes.ok) {
    localStorage.removeItem("sb_session");
    window.location.replace("login.html");
    return;
  }

  const authUser = await authRes.json();

  if (!authUser || !authUser.id) {
    window.location.replace("login.html");
    return;
  }

  // User aus der eigenen users-Tabelle laden
  const userRes = await fetch(
    `${supabaseUrl}/rest/v1/users?select=*&auth_id=eq.${encodeURIComponent(authUser.id)}`,
    { headers: getHeaders() }
  );

  const users = userRes.ok ? await userRes.json() : [];
  const user = users[0];

  if (!user) {
    console.error("User nicht in der users-Tabelle gefunden!");
    return;
  }

  currentUser = user;

  renderQRCode(user.qr_code);
  updateCoinsDisplay();
  checkRewards();
  loadHistory();
  renderProfile();
  loadRewards();

  if (user.is_admin) {
    document.getElementById("admin-panel").style.display = "block";
  }

  console.log(currentUser);
}

const searchUserBtn = document.getElementById("search-user-btn");

if (searchUserBtn) {
  searchUserBtn.onclick = async () => {
    // 1. Entfernt Leerzeichen vorne und hinten aus deiner Such-Eingabe
    const name = document.getElementById("user-search").value.trim();

    if (!name) {
      alert("Bitte einen Namen eingeben");
      return;
    }

    // 2. Sucht nach dem Namen, auch wenn in der Datenbank Leerzeichen davor oder danach hängen
    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?select=*&name=ilike.${encodeURIComponent(`*${name}*`)}`,
      { headers: getHeaders() }
    );

    if (!res.ok) {
      console.error("Datenbank-Fehler:", await res.text());
      alert("Fehler bei der Suche");
      return;
    }

    const data = await res.json();

    // 3. Filtert in JavaScript exakt auf den bereinigten Namen (ignoriert Leerzeichen in der DB!)
    const exactUser = data?.find(
      (user) => user.name && user.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (!exactUser) {
      alert("Nutzer nicht gefunden");
      return;
    }

    document.getElementById("admin-user-result").innerHTML = `
      <h4>${exactUser.name.trim()}</h4>
      <p>Coins: <span id="display-coins">${exactUser.coins}</span></p>
      <button onclick="changeCoins('${exactUser.id}', 10)">+10</button>
      <button onclick="changeCoins('${exactUser.id}', 50)">+50</button>
      <button onclick="changeCoins('${exactUser.id}', -10)">-10</button>
      <button onclick="changeCoins('${exactUser.id}', -50)">-50</button>
    `;
  };
}

window.changeCoins = async function (userId, amount) {
  const coinDisplay = document.getElementById("display-coins");
  const currentCoins = Number(coinDisplay.innerText);
  const newCoins = currentCoins + amount;

  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: getHeaders({ "Prefer": "return=minimal" }),
      body: JSON.stringify({ coins: newCoins })
    }
  );

  if (!updateRes.ok) {
    console.error("Update-Fehler:", await updateRes.text());
    alert("Coins konnten nicht gespeichert werden");
    return;
  }

  await fetch(`${supabaseUrl}/rest/v1/transactions`, {
    method: "POST",
    headers: getHeaders({ "Prefer": "return=minimal" }),
    body: JSON.stringify({
      user_id: userId,
      eco_coins: amount,
      description: "Admin Änderung"
    })
  });

  coinDisplay.innerText = newCoins;
  alert("Coins geändert");
};

// --- COINS ANZEIGE ---
function updateCoinsDisplay() {
  coinsDisplay.innerText = currentUser.coins;
}

// --- HISTORY LADEN ---
async function loadHistory() {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/transactions?select=*&user_id=eq.${encodeURIComponent(currentUser.id)}&order=created_at.desc&limit=5`,
    { headers: getHeaders() }
  );
  const data = res.ok ? await res.json() : [];

  historyList.innerHTML = "";

  if (!data) return;

  data.forEach(entry => {
    const li = document.createElement("li");
    li.innerText = `${entry.description} (+${entry.eco_coins})`;
    historyList.appendChild(li);
  });
}

const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: getHeaders()
    }).catch(() => {});
    localStorage.removeItem("sb_session");
    window.location.replace("login.html");
  };
}

window.openHistoryModal = async function () {
  const modal = document.getElementById("history-modal");
  const list = document.getElementById("history-full");

  list.innerHTML = "";

  const res = await fetch(
    `${supabaseUrl}/rest/v1/transactions?select=*&user_id=eq.${encodeURIComponent(currentUser.id)}&order=created_at.desc`,
    { headers: getHeaders() }
  );
  const data = res.ok ? await res.json() : [];

  if (data) {
    data.forEach(entry => {
      const li = document.createElement("li");
      li.innerText = `${entry.description} (+${entry.eco_coins})`;
      list.appendChild(li);
    });
  }

  modal.classList.add("show");
};

window.closeHistoryModal = function () {
  document.getElementById("history-modal").classList.remove("show");
};

// --- APP STARTEN ---
loadUser();
