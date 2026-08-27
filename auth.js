import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseUrl = "https://loyxqwxuicyilyciekzh.supabase.co";
const supabaseKey = "sb_publishable_m-LXnPrRFZaAsXo_U5Zv_w_OO13GIZH";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Navigation ---
window.goRegister = () => window.location.href = "register.html";
window.goLogin = () => window.location.href = "login.html";

// --- LOGIN ---
window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    document.getElementById("auth-msg").innerText = "Login fehlgeschlagen!";
    return;
  }

  // Weiter zur App
  window.location.replace("index.html");

};

// --- REGISTRIEREN ---
window.register = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const name = document.getElementById("name").value;

  // 1) Auth-Konto erstellen
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    document.getElementById("auth-msg").innerText = "Registrierung fehlgeschlagen!";
    console.error(error);
    return;
  }

  // 2) QR-Code generieren
  const qrCode = "eco_" + Math.random().toString(36).substring(2, 10);

  // 3) User in eigene Tabelle eintragen
  const { error: insertError } = await supabase.from("users").insert({
    name: name,
    qr_code: qrCode,
    coins: 0,
    auth_id: data.user.id
  });

  if (insertError) {
    console.error("Fehler beim Einfügen in users:", insertError);
    document.getElementById("auth-msg").innerText = "Fehler beim Speichern!";
    return;
  }

  document.getElementById("auth-msg").innerText = "Konto erstellt! Bitte einloggen.";
};



