// --- SUPABASE VERBINDUNG ---
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseUrl = "https://loyxqwxuicyilyciekzh.supabase.co";
const supabaseKey = "sb_publishable_m-LXnPrRFZaAsXo_U5Zv_w_OO13GIZH";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- DOM ELEMENTE ---
const coinsDisplay = document.getElementById("coins");
const historyList = document.getElementById("history");
const qrBox = document.getElementById("qr-box");

// --- USER DATEN ---
let currentUser = null;

// --- AUTO-LOGOUT NACH 5 MIN ---
setTimeout(async () => {
  await supabase.auth.signOut();
  window.location.replace("login.html");
}, 5 * 60 * 1000);


// --- AUTOMATISCHEN GUTSCHEIN ERSTELLEN ---
async function checkRewards() {
  if (!currentUser) return;

  // Nur wenn User genug Coins hat
  if (currentUser.coins < 100) return;

  // Prüfen, ob User schon einen Apfel-Gutschein hat
  const { data: existing } = await supabase
    .from("rewards")
    .select("*")
    .eq("user_id", currentUser.auth_id)
    .eq("reward_name", "Gratis Apfel")
    .eq("redeemed", false);

  if (existing && existing.length > 0) {
    return; // Gutschein existiert bereits
  }

  // Gutschein erzeugen
  await supabase.from("rewards").insert({
    user_id: currentUser.auth_id,
    reward_name: "Gratis Apfel",
    cost: 100,
    redeemed: false
  });

  console.log("Gutschein erstellt: Gratis Apfel");
}


// --- QR-CODE GENERIEREN ---
function renderQRCode(qrText) {
  if (!qrText || qrText.trim() === "") {
    console.error("QR-Code ist leer – kann nicht generiert werden.");
    return;
  }

  qrBox.innerHTML = ""; // Reset

  new QRCode(qrBox, {
    text: qrText,
    width: 180,
    height: 180,
    colorDark: "#2e7d32",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}
function renderProfile() {
  document.getElementById("profile-name").innerText = currentUser.name;
  
}

async function loadRewards() {
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .eq("user_id", currentUser.auth_id)
    .eq("redeemed", false);

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


// --- USER LADEN ---
async function loadUser() {
  const { data: auth } = await supabase.auth.getUser();

  if (!auth || !auth.user) {
    window.location.replace("login.html");
    return;
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_id", auth.user.id)
    .single();

  if (error || !user) {
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


}


// --- COINS ANZEIGE ---
function updateCoinsDisplay() {
  coinsDisplay.innerText = currentUser.coins;
}


// --- HISTORY LADEN ---
async function loadHistory() {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(5);

  historyList.innerHTML = "";

  if (!data) return;

  data.forEach(entry => {
    const li = document.createElement("li");
    li.innerText = `${entry.description} (+${entry.eco_coins})`;
    historyList.appendChild(li);
  });
}
document.getElementById("logout-btn").onclick = async () => {
  await supabase.auth.signOut();
  window.location.replace("login.html");
};


// --- APP STARTEN ---
loadUser();
