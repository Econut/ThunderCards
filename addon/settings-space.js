browser.spaces.create("thunderCardsSettings", browser.runtime.getURL("options.html"), {
  title: "ThunderCards settings",
  defaultIcons: "thundercards-icon.svg",
}).catch(console.error);
