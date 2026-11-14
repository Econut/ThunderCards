const palette = {
  colors: { frame: "#080e19", tab_background_text: "#ffffff" },
};

const themed = new Set();
let enabled = false;
let queue = Promise.resolve();
function schedule(task) {
  queue = queue.then(task).catch(console.error);
}

async function apply(window) {
  if (window.type !== "normal" || themed.has(window.id)) {
    return;
  }
  await browser.theme.update(window.id, palette);
  themed.add(window.id);
}

async function sync() {
  const state = await browser.storage.local.get({ emberThemeEnabled: true });
  enabled = state.emberThemeEnabled;
  await browser.senderLines.setFullBanner(enabled);
  if (enabled) {
    for (const window of await browser.windows.getAll({ windowTypes: ["normal"] })) {
      await apply(window);
    }
  } else {
    for (const id of themed) {
      try {
        await browser.theme.reset(id);
      } catch (error) {
        console.error(error);
      }
      themed.delete(id);
    }
    await browser.senderLines.restoreUnderlyingTheme();
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.emberThemeEnabled) {
    schedule(sync);
  }
});
browser.windows.onCreated.addListener(window => schedule(async () => {
  if (enabled) await apply(window);
}));
browser.windows.onRemoved.addListener(id => themed.delete(id));
schedule(sync);






