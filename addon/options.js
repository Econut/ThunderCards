const $ = id => document.getElementById(id);
const account = $("account");
const label = $("label");
const color = $("color");
const automatic = $("automatic");
const status = $("status");
let entries;

function showAccount() {
  const entry = entries.find(item => item.id === account.value);
  if (!entry) return;
  label.value = entry.labelOverride;
  label.placeholder = entry.label;
  color.value = entry.color;
  automatic.checked = !entry.colorOverride;
  color.disabled = automatic.checked;
}

async function save(reset) {
  try {
    await browser.senderLines.saveBadge(account.value,
      reset ? "" : label.value.trim().toUpperCase(),
      reset || automatic.checked ? "" : color.value);
    entries = await browser.senderLines.listBadges();
    showAccount();
    status.textContent = "Badge updated.";
  } catch (error) {
    status.textContent = error.message;
  }
}

async function init() {
  entries = await browser.senderLines.listBadges();
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name === entry.email ? entry.name : `${entry.name} (${entry.email})`;
    account.append(option);
  }
  const requested = new URL(location.href).searchParams.get("account");
  if (entries.some(entry => entry.id === requested)) account.value = requested;
  showAccount();
  account.onchange = showAccount;
  automatic.onchange = () => { color.disabled = automatic.checked; };
  $("reset").onclick = () => save(true);
  document.querySelector("form").onsubmit = event => {
    event.preventDefault();
    save(false);
  };
}
init().catch(error => { status.textContent = error.message; });

async function initTheme() {
  const toggle = $("ember");
  const settings = await browser.storage.local.get({ emberThemeEnabled: true });
  toggle.checked = settings.emberThemeEnabled;
  toggle.disabled = false;
  toggle.onchange = async () => {
    try {
      await browser.storage.local.set({ emberThemeEnabled: toggle.checked });
      $("theme-status").textContent = "";
    } catch (error) {
      toggle.checked = !toggle.checked;
      $("theme-status").textContent = error.message;
    }
  };
}
initTheme().catch(error => { $("theme-status").textContent = error.message; });
