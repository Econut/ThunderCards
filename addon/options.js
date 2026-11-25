const $ = id => document.getElementById(id);
const account = $("account");
const label = $("label");
const color = $("color");
const automatic = $("automatic");
const status = $("status");
let entries;

function updateBadgePreview() {
  const entry = entries.find(item => item.id === account.value);
  const preview = $("badge-preview");
  preview.textContent = entry ? label.value.trim().toUpperCase() || entry.label : "";
  preview.style.color = entry ? (automatic.checked ? entry.automaticColor : color.value) : "";
}

function showAccount() {
  const entry = entries.find(item => item.id === account.value);
  if (!entry) return;
  label.value = entry.labelOverride;
  label.placeholder = entry.label;
  color.value = entry.color;
  automatic.checked = !entry.colorOverride;
  color.disabled = automatic.checked;
  updateBadgePreview();
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
  automatic.onchange = () => {
    color.disabled = automatic.checked;
    updateBadgePreview();
  };
  label.oninput = color.oninput = updateBadgePreview;
  $("reset").onclick = () => save(true);
  document.querySelector("form").onsubmit = event => {
    event.preventDefault();
    save(false);
  };
}
init().catch(error => { status.textContent = error.message; });

async function initTheme() {
  const toggle = $("theme-enabled");
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

async function initRestoreEmail() {
  const toggle = $("restore-email");
  toggle.checked = await browser.senderLines.getRestoreEmail();
  toggle.disabled = false;
  toggle.onchange = async () => {
    try {
      await browser.senderLines.setRestoreEmail(toggle.checked);
      $("restore-status").textContent = "";
    } catch (error) {
      toggle.checked = !toggle.checked;
      $("restore-status").textContent = error.message;
    }
  };
}
initRestoreEmail().catch(error => { $("restore-status").textContent = error.message; });

const manifest = browser.runtime.getManifest();
async function initGroupedNotifications() {
  const toggle = $("group-notifications");
  const delay = $("notification-delay");
  const settings = await browser.senderLines.getGroupedNotifications();
  toggle.checked = settings.enabled;
  delay.value = String(settings.delay);
  toggle.disabled = false;
  delay.disabled = !toggle.checked;
  toggle.onchange = delay.onchange = async () => {
    try {
      await browser.senderLines.setGroupedNotifications(toggle.checked, Number(delay.value));
      delay.disabled = !toggle.checked;
      $("notification-status").textContent = "";
    } catch (error) {
      $("notification-status").textContent = error.message;
    }
  };
}
initGroupedNotifications().catch(error => { $("notification-status").textContent = error.message; });
$("about-version").textContent = `Version ${manifest.version}`;
const repository = manifest.homepage_url.replace(/\/$/, "");
for (const [id, url] of [
  ["github-repository", repository],
  ["github-issues", repository + "/issues"],
]) {
  const link = $(id);
  link.href = url;
  const open = async event => {
    event.preventDefault();
    try {
      await browser.windows.openDefaultBrowser(url);
      $("about-status").textContent = "";
    } catch {
      $("about-status").textContent = "Thunderbird could not open the default browser.";
    }
  };
  link.addEventListener("click", open);
  link.addEventListener("auxclick", event => {
    if (event.button === 1) open(event);
  });
}
