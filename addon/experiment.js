/* global ExtensionAPI, ChromeUtils, Ci, Cu, Services */
const { ExtensionSupport } = ChromeUtils.importESModule(
  "resource:///modules/ExtensionSupport.sys.mjs"
);
const { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);

const PANE_URL = "about:3pane";
const ROW_PITCH = 117; // 105px card + 8px margins + 4px cell padding.

const { FolderTreeProperties } = ChromeUtils.importESModule(
  "resource:///modules/FolderTreeProperties.sys.mjs"
);
const BADGE_PREF = "extensions.thundercards.accountBadges";
const PALETTE = ["#2257a5", "#a25a1d", "#7041a8", "#216b48", "#8b365d", "#1e6575"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function labelFor(name, used) {
  const words = name.normalize("NFKD").toUpperCase().match(/[A-Z]+/g) ?? [];
  const letters = words.join("");
  const preferred = words.length > 1 ? words[0][0] + words[1][0] : letters.slice(0, 2);
  if (preferred.length === 2 && !used.has(preferred)) {
    return preferred;
  }
  const first = letters[0] || "A";
  for (const second of letters.slice(1) + LETTERS) {
    if (!used.has(first + second)) {
      return first + second;
    }
  }
  for (const a of LETTERS) {
    for (const b of LETTERS) {
      if (!used.has(a + b)) {
        return a + b;
      }
    }
  }
  return "";
}

function paintBadge(badge, entry) {
  badge.textContent = entry.label;
  badge.title = entry.email || entry.name;
  badge.style.setProperty("--account-badge-background", entry.color);
  const rgb = entry.color.slice(1).match(/../g).map(pair => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  badge.style.setProperty("--account-badge-text", luminance > 0.179 ? "#111" : "#fff");
}

function isCombinedView(pane) {
  const view = pane.gViewWrapper;
  if (view?.isSynthetic) {
    return true;
  }
  return Boolean(pane.gFolder?.getFlag(Ci.nsMsgFolderFlags.Virtual) &&
    new Set(view?._underlyingFolders?.map(folder => folder.server.key)).size > 1);
}

function renderAccountBadge(row, entry) {
  const existing = row.querySelector(".cards-account-badge");
  if (!entry?.label) {
    existing?.remove();
    return;
  }
  const badge = existing ?? row.ownerDocument.createElement("span");
  badge.className = "cards-account-badge";
  paintBadge(badge, entry);
  if (!existing) {
    row.querySelector(".thread-card-icon-info")?.append(badge);
  }
}

function folderBadgeTarget(row) {
  if (row.modeName === "all" || row.modeName === "smart") {
    const folder = MailServices.folderLookup.getFolderForURL(row.uri);
    if (folder?.isServer) {
      return { folder, target: row.icon };
    }
    if (row.modeName === "smart" && row.accountIndicator?.style.getPropertyValue("--account-color")) {
      return { folder, target: row.accountIndicator };
    }
  }
  return {};
}

function watchFolderBadges(pane, getEntry, openEditor) {
  const tree = pane.document.getElementById("folderTree");
  const popup = pane.document.getElementById("folderPaneContext");
  const item = pane.document.createXULElement("menuitem");
  item.setAttribute("label", "Edit account badge");
  item.hidden = true;
  popup.append(item);
  let accountId;
  let clickedRow;
  const onContext = event => {
    clickedRow = event.target.closest?.('li[is="folder-tree-row"]');
  };
  tree.addEventListener("contextmenu", onContext, true);
  const onPopup = event => {
    if (event.target !== popup) {
      return;
    }
    const row = clickedRow ?? popup.triggerNode?.closest?.('li[is="folder-tree-row"]') ??
      pane.folderTree.selectedRow;
    clickedRow = null;
    const { folder } = row ? folderBadgeTarget(row) : {};
    const entry = getEntry(folder?.server);
    accountId = entry?.id;
    item.hidden = !accountId;
  };
  const onCommand = event => {
    event.stopPropagation();
    if (accountId) {
      openEditor(accountId);
    }
  };
  popup.addEventListener("popupshowing", onPopup);
  item.addEventListener("command", onCommand);

  const paint = row => {
    const { folder, target } = folderBadgeTarget(row);
    const entry = target && getEntry(folder?.server);
    const previous = row.querySelector(":scope > .container .folder-account-badge") ??
      targets.get(row)?.nextElementSibling;
    if (!entry?.label) {
      if (targets.has(row)) {
        const old = targets.get(row);
        old.nextElementSibling?.classList.contains("folder-account-badge") &&
          old.nextElementSibling.remove();
        old.classList.remove("folder-account-icon-replaced");
        targets.delete(row);
      }
      return;
    }

    const badge = previous?.classList.contains("folder-account-badge") ? previous :
      row.ownerDocument.createElement("span");
    badge.className = "folder-account-badge";
    badge.setAttribute("aria-hidden", "true");
    paintBadge(badge, entry);
    if (badge.previousElementSibling !== target) {
      target.after(badge);
    }
    target.classList.add("folder-account-icon-replaced");
    targets.set(row, target);
  };
  const targets = new Map();
  const refresh = () => {
    for (const row of targets.keys()) {
      if (!tree.contains(row)) {
        targets.delete(row);
      }
    }
    tree.querySelectorAll('li[is="folder-tree-row"]').forEach(paint);
  };
  const observer = new pane.MutationObserver(records => {
    let removed = false;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.matches?.('li[is="folder-tree-row"]')) {
          paint(node);
        }
        node.querySelectorAll?.('li[is="folder-tree-row"]').forEach(paint);
      }
      removed ||= [...record.removedNodes].some(node =>
        node.matches?.('li[is="folder-tree-row"]') ||
        node.querySelector?.('li[is="folder-tree-row"]'));
    }
    if (removed) {
      for (const row of targets.keys()) {
        if (!tree.contains(row)) {
          targets.delete(row);
        }
      }
    }
  });
  observer.observe(tree, { childList: true, subtree: true });
  refresh();
  return {
    refresh,
    stop() {
      observer.disconnect();
      tree.removeEventListener("contextmenu", onContext, true);
      popup.removeEventListener("popupshowing", onPopup);
      item.remove();
      for (const target of targets.values()) {
        target.classList.remove("folder-account-icon-replaced");
        if (target.nextElementSibling?.classList.contains("folder-account-badge")) {
          target.nextElementSibling.remove();
        }
      }
      targets.clear();
    },
  };
}

function canMoveToTrash(header) {
  const folder = header?.folder;
  if (!folder?.canDeleteMessages ||
      folder.isSpecialFolder(Ci.nsMsgFolderFlags.Trash, true) ||
      (header.flags & Ci.nsMsgMessageFlags.IMAPDeleted)) {
    return false;
  }

  const server = folder.server;
  if (!["none", "pop3", "imap"].includes(server.type)) {
    return false;
  }
  if (server.type === "imap" &&
      server.QueryInterface(Ci.nsIImapIncomingServer).deleteModel !==
        Ci.nsMsgImapDeleteModels.MoveToTrash) {
    return false;
  }
  return Boolean(server.rootMsgFolder.getFolderWithFlags(Ci.nsMsgFolderFlags.Trash));
}

function renderQuickDelete(row, pane, header) {
  const menu = row.querySelector(".tree-button-more");
  if (!menu) {
    return;
  }
  let button = menu.previousElementSibling;
  if (!button?.classList.contains("cards-quick-delete")) {
    button = row.ownerDocument.createElement("button");
    button.className = "button icon-button icon-only cards-quick-delete";
    button.type = "button";
    button.tabIndex = -1;
    button.title = "Delete message";
    button.setAttribute("aria-label", button.title);
    const svgNS = "http://www.w3.org/2000/svg";
    const icon = row.ownerDocument.createElementNS(svgNS, "svg");
    icon.setAttribute("viewBox", "0 0 16 16");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("width", "14");
    icon.setAttribute("height", "14");
    const path = row.ownerDocument.createElementNS(svgNS, "path");
    path.setAttribute("d", "M2.5 4h11M6 4V2.5h4V4M4 4l.6 9.2a1 1 0 0 0 1 .8h4.8a1 1 0 0 0 1-.8L12 4M6.5 6.5v5m3-5v5");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.35");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    icon.append(path);
    button.append(icon);
    menu.before(button);
  }

  button.disabled = !canMoveToTrash(header);
  button.hidden = !header;
  const folderURI = header?.folder?.URI;
  const messageKey = header?.messageKey;
  const view = row.view;
  let pressedIndex;
  button.onmousedown = event => {
    event.preventDefault();
    event.stopPropagation();
    pressedIndex = row.index;
  };
  button.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail > 1 || button.disabled || !row.isConnected ||
        (event.detail && pressedIndex !== row.index) ||
        view !== pane.gDBView || pane.threadTree.getRowAtIndex(row.index) !== row ||
        pane.mailContextMenu.selectionIsOverridden) {
      return;
    }

    try {
      const current = view.getMsgHdrAt(row.index);
      if (current?.folder?.URI !== folderURI || current?.messageKey !== messageKey ||
          !canMoveToTrash(current)) {
        button.disabled = true;
        return;
      }
      if (view.selection.isSelected(row.index)) {
        if (view.getSelectedMsgHdrs().every(canMoveToTrash)) {
          pane.commandController.doCommand("cmd_deleteMessage");
        }
        return;
      }

      // Use the same temporary selection as a native context-menu action.
      pane.mailContextMenu.setOverrideSelection(row.index);
      try {
        const targets = view.getSelectedMsgHdrs();
        if (!targets.length || !targets.every(canMoveToTrash)) {
          button.disabled = true;
          return;
        }
        if (pane.commandController.isCommandEnabled("cmd_deleteMessage")) {
          pane.commandController.doCommand("cmd_deleteMessage");
        }
      } finally {
        pane.mailContextMenu.clearOverrideSelection();
      }
    } catch (error) {
      button.disabled = true;
      Cu.reportError(error);
    }
  };
}
const DUMMY_ROW = 0x20000000;

function useNextRowAfterDelete(pane) {
  const controller = pane.commandController;
  const listener = pane.dbViewWrapperListener;
  const updater = listener.threadPaneCommandUpdater;
  const commands = controller._callbackCommands;
  const original = commands.cmd_deleteMessage;
  const removed = listener.onMessagesRemoved;
  const failed = listener.onMessageRemovalFailed;
  let pending;

  function onRemoved(...args) {
    if (pending) {
      const { view, header, below, above, staysInView } = pending;
      if (pane.gDBView !== view) {
        pending = null;
      } else if (view.findIndexOfMsgHdr(header, false) === 0xffffffff ||
                 (staysInView && (header.flags & Ci.nsMsgMessageFlags.IMAPDeleted))) {
        pending = null;
        if (listener._nextViewIndexAfterDelete != null &&
            !pane.mailContextMenu.selectionIsOverridden) {
          const belowIndex = below ? view.findIndexOfMsgHdr(below, false) : 0xffffffff;
          const aboveIndex = above ? view.findIndexOfMsgHdr(above, false) : 0xffffffff;
          if (belowIndex !== 0xffffffff || aboveIndex !== 0xffffffff) {
            listener._nextViewIndexAfterDelete = belowIndex !== 0xffffffff ? belowIndex : aboveIndex;
          }
        }
      }
    }
    return removed.apply(this, args);
  }

  function onFailed(...args) {
    pending = null;
    return failed.apply(this, args);
  }

  const cancel = () => { pending = null; };
  pane.addEventListener("folderURIChanged", cancel);
  listener.onMessagesRemoved = onRemoved;
  listener.onMessageRemovalFailed = onFailed;

  function deleteMessage(...args) {
    pending = null;
    const tree = pane.threadTree;
    const view = pane.gDBView;
    const index = tree.selectedIndex;
    if (tree.getAttribute("rows") !== "thread-card" ||
        pane.mailContextMenu.selectionIsOverridden || !view ||
        index < 0 || index >= view.rowCount || view.selection.count !== 1 ||
        view.numSelected !== 1 || (view.getFlagsAt(index) & DUMMY_ROW)) {
      return original.apply(this, args);
    }

    const header = view.getMsgHdrAt(index);
    const server = header.folder.server;
    const staysInView = server.type === "imap" &&
      server.QueryInterface(Ci.nsIImapIncomingServer).deleteModel ===
        Ci.nsMsgImapDeleteModels.IMAPDelete;
    let next = index + 1;
    while (next < view.rowCount && (view.getFlagsAt(next) & DUMMY_ROW)) {
      next++;
    }
    let previous = index - 1;
    while (previous >= 0 && (view.getFlagsAt(previous) & DUMMY_ROW)) {
      previous--;
    }
    const below = next < view.rowCount ? view.getMsgHdrAt(next) : null;
    const above = previous >= 0 ? view.getMsgHdrAt(previous) : null;

    // Keep the native completion listener and its reading-pane select event.
    // Override only its candidate during this explicit Delete command.
    const update = updater.updateNextMessageAfterDelete;
    function updateNext() {
      update.call(this);
      if (pane.gDBView === view) {
        pending = { view, header, below, above, staysInView };
      }
    }
    updater.updateNextMessageAfterDelete = updateNext;
    try {
      return original.apply(this, args);
    } finally {
      if (updater.updateNextMessageAfterDelete === updateNext) {
        updater.updateNextMessageAfterDelete = update;
      }
    }
  }

  commands.cmd_deleteMessage = deleteMessage;
  return () => {
    pane.removeEventListener("folderURIChanged", cancel);
    if (listener.onMessagesRemoved === onRemoved) {
      listener.onMessagesRemoved = removed;
    }
    if (listener.onMessageRemovalFailed === onFailed) {
      listener.onMessageRemovalFailed = failed;
    }
    if (commands.cmd_deleteMessage === deleteMessage) {
      commands.cmd_deleteMessage = original;
    }
  };
}
function renderSender(row, pane, header) {
  const sender = row.senderLine;
  if (!sender || 
      pane.threadPane.cardColumns?.[1] !== "senderCol") {
    return;
  }

  const author = header?.mime2DecodedAuthor;
  if (!author) {
    return;
  }

  const mailboxes = MailServices.headerParser.parseDecodedHeader(author, false)
    .filter(mailbox => mailbox.email?.lastIndexOf("@") > 0 &&
      !mailbox.email.endsWith("@"));
  if (!mailboxes.length) {
    return;
  }

  const names = mailboxes.map(mailbox => mailbox.name?.trim()).filter(Boolean);
  const address = mailboxes.map(mailbox => mailbox.email).join(", ");
  const nameLine = row.ownerDocument.createElement("bdi");
  nameLine.className = "unified-inbox-sender-part";
  nameLine.textContent = names.join(", ") || "\u00a0";
  const addressLine = row.ownerDocument.createElement("bdi");
  addressLine.className = "unified-inbox-sender-part unified-inbox-sender-address";
  addressLine.textContent = address;
  sender.replaceChildren(nameLine, addressLine);
  sender.title = names.length ? names.join(", ") + "\n" + address : address;
}

this.senderLines = class extends ExtensionAPI {
  getAPI() {
    return { senderLines: {
      setFullBanner: async enabled => {
        this.fullBanner = enabled;
        for (const window of this.windows.keys()) this.updateFullBanner(window);
      },
      restoreUnderlyingTheme: async () => this.restoreUnderlyingTheme(),
      listBadges: async () => [...this.badges.values()],
      saveBadge: async (id, label, color) => this.saveBadge(id, label, color),
    } };
  }

  saveBadge(id, label, color) {
    if (!this.badges.has(id) || (label && !/^[A-Z]{2}$/.test(label)) ||
        (color && !/^#[0-9a-f]{6}$/i.test(color))) {
      throw new Error("Enter two letters and a valid colour.");
    }
    if (label && [...this.badges.values()].some(entry => entry.id !== id && entry.label === label)) {
      throw new Error("That label is already in use.");
    }
    const config = this.config[id];
    config.label = label;
    config.color = color;
    this.refreshBadges();
  }

  refreshBadges() {
    if (!this.active) {
      return;
    }
    const accounts = MailServices.accounts.accounts.filter(account =>
      account.defaultIdentity && !["nntp", "rss", "none"].includes(account.incomingServer.type));
    const used = new Set();
    for (const account of accounts) {
      const id = account.key;
      if (!this.config[id]) {
        this.config[id] = { label: "", color: "", automatic: "" };
      }
      if (this.config[id].label) {
        used.add(this.config[id].label);
      }
    }

    const badges = new Map();
    const servers = new Map();
    for (const account of accounts) {
      const id = account.key;
      const config = this.config[id];
      const server = account.incomingServer;
      const name = server.prettyName;
      const email = account.defaultIdentity.email;
      const automatic = config.automatic && !used.has(config.automatic) ?
        config.automatic : labelFor(name || email, used);
      if (!config.label) {
        config.automatic = automatic;
        used.add(automatic);
      }
      const saved = this.nativeColorsReady && FolderTreeProperties.getColor(server.rootFolder.URI);
      const fallback = PALETTE[[...id].reduce((hash, ch) =>
        (hash * 31 + ch.charCodeAt(0)) >>> 0, 0) % PALETTE.length];
      const color = config.color || (/^#[0-9a-f]{6}$/i.test(saved) ? saved : fallback);
      badges.set(id, { id, name, email, label: config.label || automatic,
        color, labelOverride: config.label, colorOverride: config.color });
      servers.set(server.key, id);
    }
    this.badges = badges;
    this.servers = servers;
    const serialized = JSON.stringify(this.config);
    if (Services.prefs.getStringPref(BADGE_PREF, "") !== serialized) {
      Services.prefs.setStringPref(BADGE_PREF, serialized);
    }
    for (const detach of this.panes.values()) {
      detach.refreshBadges();
    }
  }

  openEditor(id) {
    const win = Services.wm.getMostRecentWindow("mail:3pane");
    win?.document.getElementById("tabmail")?.openTab("contentTab", {
      url: this.extension.baseURI.resolve("options.html") + "?account=" + encodeURIComponent(id),
    });
  }


  onStartup() {
    this.active = true;
    this.panes = new Map();
    this.windows = new Map();
    try {
      this.config = JSON.parse(Services.prefs.getStringPref(BADGE_PREF, "{}"));
    } catch {
      this.config = {};
    }
    this.badges = new Map();
    this.servers = new Map();
    FolderTreeProperties.ready.then(() => {
      this.nativeColorsReady = true;
      this.refreshBadges();
    }, Cu.reportError);
    this.refreshBadges();
    this.badgeObserver = (_subject, topic, pref) => {
      if (topic === "nsPref:changed" && pref !== "mail.accountmanager.accounts" &&
          !/\.(name|type|hostname|userName|server|identities|useremail)$/.test(pref)) {
        return;
      }
      if (!this.refreshScheduled) {
        this.refreshScheduled = true;
        Promise.resolve().then(() => {
          this.refreshScheduled = false;
          this.refreshBadges();
        });
      }
    };
    for (const topic of ["server-color-changed", "message-account-removed"]) {
      Services.obs.addObserver(this.badgeObserver, topic);
    }
    for (const pref of ["mail.accountmanager.accounts", "mail.account.", "mail.server.", "mail.identity."]) {
      Services.prefs.addObserver(pref, this.badgeObserver);
    }
    ExtensionSupport.registerWindowListener(this.extension.id, {
      chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
      onLoadWindow: window => this.watchWindow(window),
      onUnloadWindow: window => this.unwatchWindow(window),
    });
  }

  restoreUnderlyingTheme(windows = this.windows.keys()) {
    const { LightweightThemeManager } = ChromeUtils.importESModule(
      "resource://gre/modules/LightweightThemeManager.sys.mjs"
    );
    // Thunderbird clears a per-window override without repainting its fallback.
    for (const window of windows) {
      if (!window.closed) {
        Services.obs.notifyObservers({
          ...LightweightThemeManager.themeData,
          window: window.docShell.outerWindowID,
        }, "lightweight-theme-styling-update");
      }
    }
  }

  updateFullBanner(window) {
    const root = window.document.documentElement;
    const attribute = "thundercards-full-banner";
    const active = root.hasAttribute(attribute);
    if (active === Boolean(this.fullBanner)) return;
    const sheet = this.extension.rootURI.resolve("ember-banner.css");
    const utils = window.windowUtils;
    if (this.fullBanner) {
      utils.loadSheetUsingURIString(sheet, utils.USER_SHEET);
      root.setAttribute(attribute, "");
    } else {
      root.removeAttribute(attribute);
      utils.removeSheetUsingURIString(sheet, utils.USER_SHEET);
    }
  }

  watchWindow(window) {
    const tabmail = window.document.getElementById("tabmail");
    if (!tabmail || this.windows.has(window)) { return; }
    const scan = () => {
      for (const tab of tabmail.tabInfo) {
        const browser = tab.chromeBrowser;
        if (browser?.currentURI?.spec === PANE_URL) {
          this.attach(browser.contentWindow);
        }
      }
    };
    const onReady = event => {
      if (event.target.documentURI === PANE_URL) {
        this.attach(event.target.defaultView);
      }
    };
    tabmail.addEventListener("DOMContentLoaded", onReady, true);
    tabmail.addEventListener("TabSelect", scan);
    this.windows.set(window, () => {
      tabmail.removeEventListener("DOMContentLoaded", onReady, true);
      tabmail.removeEventListener("TabSelect", scan);
    });
    scan();
    this.updateFullBanner(window);
  }

  unwatchWindow(window) {
    this.windows.get(window)?.();
    this.windows.delete(window);
  }

  async attach(pane) {
    if (!this.active || !pane || this.panes.has(pane)) {
      return;
    }
    await pane.hasDOMContentLoaded?.promise;
    await pane.customElements.whenDefined("thread-card");
    if (!this.active || pane.closed || this.panes.has(pane)) {
      return;
    }

    const prototype = pane.customElements.get("thread-card").prototype;
    const original = prototype.fillRow;
    const tree = pane.document.getElementById("threadTree");
    if (typeof original !== "function" || !tree) {
      return;
    }

    const card = pane.customElements.get("thread-card");
    const threadPane = pane.threadPane;
    if (!threadPane?.densityChange || !threadPane.updateThreadItemSize) {
      return;
    }

    const sheet = this.extension.rootURI.resolve("cards.css");
    const utils = pane.windowUtils;
    utils.loadSheetUsingURIString(sheet, utils.USER_SHEET);
    tree.classList.add("unified-inbox-sender-sizing");

    const originalDensityChange = threadPane.densityChange;
    async function densityChange(...args) {
      await originalDensityChange.apply(this, args);
      if (threadPane.densityChange === densityChange) {
        card.ROW_HEIGHT = ROW_PITCH;
      }
    }
    threadPane.densityChange = densityChange;

    const getEntry = server => this.badges.get(this.servers.get(server?.key));
    const folderBadges = watchFolderBadges(pane, getEntry, id => this.openEditor(id));
    function fillRow(...args) {
      const result = original.apply(this, args);
      if (prototype.fillRow === fillRow) {
        try {
          const isMessage = !this.dataset.properties.split(" ").includes("dummy");
          const header = isMessage ? this.view.getMsgHdrAt(this._index) : null;
          renderQuickDelete(this, pane, header);
          renderAccountBadge(this, isCombinedView(pane) ? getEntry(header?.folder?.server) : null);
          if (header) {
            renderSender(this, pane, header);
          }
        } catch (error) {
          Cu.reportError(error);
        }
      }
      return result;
    }

    const restoreDelete = useNextRowAfterDelete(pane);
    prototype.fillRow = fillRow;
    const onUnload = () => { folderBadges.stop(); this.panes.delete(pane); };
    pane.addEventListener("unload", onUnload, { once: true });
    const detach = () => {
      folderBadges.stop();
      pane.removeEventListener("unload", onUnload);
      restoreDelete();
      if (prototype.fillRow === fillRow) {
        prototype.fillRow = original;
      }
      utils.removeSheetUsingURIString(sheet, utils.USER_SHEET);
      tree.classList.remove("unified-inbox-sender-sizing");
      if (threadPane.densityChange === densityChange) {
        threadPane.densityChange = originalDensityChange;
      }
      threadPane.updateThreadItemSize();
    };
    detach.refreshBadges = () => { folderBadges.refresh(); tree.invalidate(); };
    this.panes.set(pane, detach);
    threadPane.updateThreadItemSize();
  }

  onShutdown(isAppShutdown) {
    this.active = false;
    ExtensionSupport.unregisterWindowListener(this.extension.id);
    for (const topic of ["server-color-changed", "message-account-removed"]) {
      Services.obs.removeObserver(this.badgeObserver, topic);
    }
    for (const pref of ["mail.accountmanager.accounts", "mail.account.", "mail.server.", "mail.identity."]) {
      Services.prefs.removeObserver(pref, this.badgeObserver);
    }
    if (isAppShutdown) {
      return;
    }
    this.fullBanner = false;
    const windows = [...this.windows.keys()];
    for (const window of windows) this.updateFullBanner(window);
    Promise.resolve().then(() => this.restoreUnderlyingTheme(windows));
    for (const stopWatching of this.windows.values()) {
      stopWatching();
    }
    for (const detach of this.panes.values()) {
      detach();
    }
    this.windows.clear();
    this.panes.clear();
    Services.obs.notifyObservers(null, "startupcache-invalidate");
  }
};

















