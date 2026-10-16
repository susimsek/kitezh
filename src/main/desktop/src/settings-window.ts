export type DesktopSettingsHtmlOptions = {
  language: "en" | "tr";
  platform: string;
  themeSource: string;
  themeCss: string;
};

export function renderDesktopSettingsHtml({
  language,
  platform,
  themeSource,
  themeCss,
}: DesktopSettingsHtmlOptions) {
  const isTurkish = language === "tr";
  const labels = isTurkish
    ? {
        title: "Ayarlar",
        general: "Genel",
        notifications: "Bildirimler",
        appearance: "Görünüm",
        updates: "Güncellemeler",
        diagnostics: "Tanı bilgileri",
        search: "Ara",
        noResults: "Sonuç bulunamadı",
        language: "Dil",
        system: "Sistem",
        english: "English",
        turkish: "Türkçe",
        generalDescription:
          "Başlangıç, dil ve hızlı erişim ayarlarını yönetin.",
        notificationsDescription:
          "Kitezh’in masaüstü bildirimlerini gösterip göstermeyeceğini seçin.",
        appearanceDescription:
          "Kitezh’in sistem görünümünü nasıl izleyeceğini seçin.",
        updatesDescription:
          "Kitezh’in masaüstü güncellemelerini nasıl alacağını seçin.",
        diagnosticsDescription:
          "Sorun giderirken güvenli çalışma zamanı bilgilerini inceleyin.",
        theme: "Tema",
        light: "Açık",
        dark: "Koyu",
        launchAtLogin: "Oturum açıldığında Kitezh’i başlat",
        showInMenuBar: "Menü çubuğunda göster",
        showInDock: "Dock’ta göster",
        notificationsEnabled: "Masaüstü bildirimlerini göster",
        globalShortcut: "Hızlı erişim kısayolu",
        shortcutHelp: "Alanı seçip yeni bir tuş kombinasyonuna basın.",
        shortcutUnavailable:
          "Bu kısayol kullanılamıyor. Başka bir kısayol seçin.",
        automaticDownload: "Güncellemeleri otomatik indir ve kur",
        checkForUpdates: "Güncellemeleri denetle",
        reset: "Varsayılanlara sıfırla",
        close: "Kapat",
        diagnosticsHelp:
          "Redakte edilmiş kayıtlar yalnızca bu cihazda tutulur (en fazla 64 KB); ekranda son 50 olay gösterilir. Kopyalama yalnızca siz istediğinizde yapılır.",
        copyDiagnostics: "Tanı bilgilerini kopyala",
        copied: "Kopyalandı",
        saving: "Kaydediliyor…",
        saved: "Kaydedildi",
        unavailable: "Kullanılamıyor",
      }
    : {
        title: "Settings",
        general: "General",
        notifications: "Notifications",
        appearance: "Appearance",
        updates: "Updates",
        diagnostics: "Diagnostics",
        search: "Search",
        noResults: "No results found",
        language: "Language",
        system: "System",
        english: "English",
        turkish: "Türkçe",
        generalDescription: "Manage startup, language, and quick access.",
        notificationsDescription:
          "Choose whether Kitezh can show desktop notifications.",
        appearanceDescription:
          "Choose how Kitezh follows your system appearance.",
        updatesDescription: "Choose how Kitezh receives desktop updates.",
        diagnosticsDescription:
          "Review safe runtime information when troubleshooting.",
        theme: "Theme",
        light: "Light",
        dark: "Dark",
        launchAtLogin: "Launch Kitezh at login",
        showInMenuBar: "Show in the menu bar",
        showInDock: "Show in the Dock",
        notificationsEnabled: "Show desktop notifications",
        globalShortcut: "Quick access shortcut",
        shortcutHelp:
          "Click the field and press a key combination to change it.",
        shortcutUnavailable:
          "This shortcut is unavailable. Choose another shortcut.",
        automaticDownload: "Automatically download and install updates",
        checkForUpdates: "Check for updates",
        reset: "Reset to defaults",
        close: "Close",
        diagnosticsHelp:
          "Redacted diagnostics stay on this device (up to 64 KB); only the latest 50 events are shown. Copying happens only when you request it.",
        copyDiagnostics: "Copy diagnostics",
        copied: "Copied",
        saving: "Saving…",
        saved: "Saved",
        unavailable: "Unavailable",
      };
  const dockControl =
    platform === "darwin"
      ? `<label class="setting-row"><span>${labels.showInDock}</span><input id="desktop-show-in-dock" type="checkbox"></label>`
      : "";
  const navigationIcons = {
    general:
      '<circle cx="12" cy="6" r="2"></circle><path d="M4 6h6m4 0h6M4 12h2m4 0h10M4 18h10m4 0h2"></path><circle cx="8" cy="12" r="2"></circle><circle cx="16" cy="18" r="2"></circle>',
    notifications:
      '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
    appearance:
      '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>',
    updates:
      '<path d="M20 7v5h-5M4 17v-5h5"></path><path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"></path>',
    diagnostics:
      '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5m0-8h.01"></path>',
  };
  const navigationButton = (
    section: keyof typeof navigationIcons,
    label: string,
    selected: boolean,
  ) =>
    `<button type="button" data-section="${section}" aria-selected="${selected}" aria-label="${label}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${navigationIcons[section]}</svg><span>${label}</span></button>`;
  const currentTheme = themeSource;
  return `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${labels.title}</title>
    <style>
      ${themeCss}
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; overflow: hidden; background: var(--dialog-background); color: var(--dialog-foreground); }
      header { display: flex; align-items: center; min-height: 64px; padding: 16px 24px; border-bottom: 1px solid var(--dialog-border); }
      header h1 { margin: 0; font-size: 21px; line-height: 1.25; font-weight: 650; letter-spacing: -.02em; }
      .layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); height: calc(100vh - 64px); min-height: 0; }
      nav { min-height: 0; overflow-y: auto; padding: 20px 12px; border-right: 1px solid var(--dialog-border); }
      .search-box { position: relative; margin: 0 4px 20px; }
      .search-box svg { position: absolute; top: 13px; left: 12px; width: 16px; height: 16px; color: var(--dialog-secondary); pointer-events: none; }
      nav input[type="search"] { appearance: none; display: block; width: 100%; min-height: var(--dialog-control-default); margin: 0; padding: 9px 12px 9px 36px; border: 1px solid var(--dialog-border); border-radius: var(--dialog-radius-sm); background: var(--dialog-surface); color: var(--dialog-foreground); font: inherit; font-size: 14px; }
      nav input[type="search"]::placeholder { color: var(--dialog-secondary); opacity: .8; }
      nav button { display: flex; align-items: center; gap: 11px; width: 100%; min-height: var(--dialog-control-default); margin: 3px 0; padding: 9px 12px; border: 0; border-radius: 9px; background: transparent; color: var(--dialog-secondary); text-align: left; font: inherit; font-size: 14px; cursor: pointer; transition: background-color .15s ease, color .15s ease; }
      nav button svg { flex: 0 0 17px; width: 17px; height: 17px; }
      nav button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      nav button:hover { background: var(--dialog-button-hover); color: var(--dialog-foreground); }
      nav button[aria-selected="true"] { background: var(--dialog-button); color: var(--dialog-foreground); font-weight: 600; }
      nav button[aria-selected="true"] svg { color: var(--dialog-primary); }
      .no-results { margin: 10px 8px; color: var(--dialog-secondary); font-size: 14px; }
      main { min-width: 0; overflow-y: auto; padding: 32px clamp(24px, 4vw, 52px) 28px; }
      section[hidden] { display: none; }
      h2 { margin: 0 0 8px; font-size: 25px; }
      .intro { max-width: 58rem; margin: 0 0 24px; color: var(--dialog-secondary); line-height: 1.5; }
      .card { border: 1px solid var(--dialog-border); border-radius: var(--dialog-radius-md); padding: 8px 18px; background: var(--dialog-surface); }
      .setting-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 50px; padding: 7px 0; border-bottom: 1px solid var(--dialog-border); }
      .setting-row:last-child { border-bottom: 0; }
      .setting-row span { font-size: 15px; }
      select, input[type="text"] { min-height: var(--dialog-control-compact); padding: 7px 10px; border: 1px solid var(--dialog-border); border-radius: var(--dialog-radius-sm); background: var(--dialog-surface); color: var(--dialog-foreground); font: inherit; }
      input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--dialog-primary); }
      .theme-options { display: flex; flex-wrap: wrap; gap: 8px; }
      .theme-options label { display: flex; align-items: center; gap: 6px; }
      .actions { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-top: 24px; }
      button.action { min-height: var(--dialog-control-default); padding: var(--dialog-space-sm) var(--dialog-space-md); border: 1px solid transparent; border-radius: var(--dialog-radius-sm); background: var(--dialog-primary); color: var(--dialog-on-primary); font: inherit; font-weight: 600; cursor: pointer; transition: background-color .15s ease; }
      button.action:hover { background: var(--dialog-primary-hover); }
      button.secondary { background: var(--dialog-button); color: var(--dialog-foreground); }
      button:disabled { cursor: wait; opacity: .65; }
      .inline-spinner { display: inline-block; width: 14px; height: 14px; margin-right: 8px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: diagnostics-spin .7s linear infinite; vertical-align: -2px; }
      @keyframes diagnostics-spin { to { transform: rotate(360deg); } }
      .status { min-height: 20px; margin: 18px 0 0; color: var(--dialog-secondary); font-size: 13px; }
      pre { overflow: auto; max-height: 300px; padding: 14px; border-radius: 8px; background: var(--dialog-button); color: var(--dialog-secondary); white-space: pre-wrap; word-break: break-word; }
      @media (max-width: 760px) {
        body { overflow: auto; }
        header { padding: 14px 20px; }
        .layout { grid-template-columns: 1fr; height: auto; min-height: calc(100vh - 64px); }
        nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-right: 0; border-bottom: 1px solid var(--dialog-border); }
        .search-box { grid-column: 1 / -1; }
        nav button span { white-space: normal; overflow: visible; }
        main { max-width: none; padding: 22px 20px; }
        .setting-row { flex-wrap: wrap; }
      }
    </style>
  </head>
  <body>
    <header><h1>${labels.title}</h1></header>
    <div class="layout">
      <nav aria-label="${labels.title}">
        <div class="search-box"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input id="desktop-settings-search" type="search" placeholder="${labels.search}" aria-label="${labels.search}"></div>
        ${navigationButton("general", labels.general, true)}
        ${navigationButton("notifications", labels.notifications, false)}
        ${navigationButton("appearance", labels.appearance, false)}
        ${navigationButton("updates", labels.updates, false)}
        ${navigationButton("diagnostics", labels.diagnostics, false)}
        <div id="desktop-settings-no-results" class="no-results" hidden>${labels.noResults}</div>
      </nav>
      <main aria-label="${labels.title}">
        <section data-panel="general">
          <h2>${labels.general}</h2>
          <p class="intro">${labels.generalDescription}</p>
          <div class="card">
            <label class="setting-row"><span>${labels.language}</span><select id="desktop-language"><option value="system">${labels.system}</option><option value="en">${labels.english}</option><option value="tr">${labels.turkish}</option></select></label>
            <label class="setting-row"><span>${labels.launchAtLogin}</span><input id="desktop-launch-at-login" type="checkbox"></label>
            <label class="setting-row"><span>${labels.showInMenuBar}</span><input id="desktop-show-in-menu-bar" type="checkbox"></label>
            ${dockControl}
            <label class="setting-row"><span>${labels.globalShortcut}</span><input id="desktop-global-shortcut" type="text" readonly aria-describedby="shortcut-help"></label>
            <p id="shortcut-help" class="status">${labels.shortcutHelp}</p>
            <p id="desktop-shortcut-status" class="status" role="status" aria-live="polite"></p>
          </div>
        </section>
        <section data-panel="notifications" hidden>
          <h2>${labels.notifications}</h2>
          <p class="intro">${labels.notificationsDescription}</p>
          <div class="card"><label class="setting-row"><span>${labels.notificationsEnabled}</span><input id="desktop-notifications" type="checkbox"></label></div>
        </section>
        <section data-panel="appearance" hidden>
          <h2>${labels.appearance}</h2>
          <p class="intro">${labels.appearanceDescription}</p>
          <div class="card theme-options">
            <label><input type="radio" name="desktop-theme" value="system">${labels.system}</label>
            <label><input type="radio" name="desktop-theme" value="light">${labels.light}</label>
            <label><input type="radio" name="desktop-theme" value="dark">${labels.dark}</label>
          </div>
        </section>
        <section data-panel="updates" hidden>
          <h2>${labels.updates}</h2>
          <p class="intro">${labels.updatesDescription}</p>
          <div class="card"><label class="setting-row"><span>${labels.automaticDownload}</span><input id="desktop-automatic-download" type="checkbox"></label></div>
          <div class="actions"><span></span><button id="desktop-check-for-updates" class="action" type="button">${labels.checkForUpdates}</button></div>
        </section>
        <section data-panel="diagnostics" hidden>
          <h2>${labels.diagnostics}</h2>
          <p class="intro">${labels.diagnosticsDescription}</p>
          <div class="card"><pre id="desktop-diagnostics">${labels.unavailable}</pre><div class="actions"><span></span><button id="desktop-copy-diagnostics" class="action secondary" type="button">${labels.copyDiagnostics}</button></div></div>
        </section>
        <div class="actions"><span id="desktop-status" class="status"></span><button id="desktop-reset" class="action secondary" type="button">${labels.reset}</button></div>
      </main>
    </div>
    <script>
      const labels = ${JSON.stringify(labels)};
      const api = window.desktopApi;
      const sections = Array.from(document.querySelectorAll("nav button[data-section]"));
      const panels = Array.from(document.querySelectorAll("section[data-panel]"));
      const search = document.getElementById("desktop-settings-search");
      const noResults = document.getElementById("desktop-settings-no-results");
      const status = document.getElementById("desktop-status");
      const shortcutStatus = document.getElementById("desktop-shortcut-status");
      const setStatus = (value) => { status.textContent = value; };
      const setBusy = (busy) => { document.querySelectorAll("button, select, input").forEach((control) => { if (control.id !== "desktop-global-shortcut") control.disabled = busy; }); };
      const setButtonBusy = (button, busy) => { let spinner = button.querySelector(".inline-spinner"); if (busy) { if (!spinner) { spinner = document.createElement("span"); spinner.className = "inline-spinner"; spinner.setAttribute("aria-hidden", "true"); button.prepend(spinner); } button.disabled = true; button.setAttribute("aria-busy", "true"); } else { spinner?.remove(); button.disabled = false; button.removeAttribute("aria-busy"); } };
      const showSection = (name) => { sections.forEach((button) => button.setAttribute("aria-selected", String(button.dataset.section === name))); panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== name; }); if (name === "diagnostics") void loadDiagnostics(); };
      sections.forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
      search.addEventListener("input", () => { const query = search.value.trim().toLocaleLowerCase(); const matchingSections = sections.filter((button) => { const panel = panels.find((candidate) => candidate.dataset.panel === button.dataset.section); const content = (button.textContent + " " + (panel?.textContent ?? "")).toLocaleLowerCase(); const matches = !query || content.includes(query); button.hidden = !matches; return matches; }); noResults.hidden = matchingSections.length > 0; if (matchingSections.length === 0) { panels.forEach((panel) => { panel.hidden = true; }); return; } const activeButton = sections.find((button) => button.getAttribute("aria-selected") === "true"); const next = activeButton && !activeButton.hidden ? activeButton : matchingSections[0]; showSection(next.dataset.section); });
      const setPreferences = async (value) => { setBusy(true); setStatus(labels.saving); try { const next = await api.preferences.set(value); applyPreferences(next); setStatus(labels.saved); shortcutStatus.textContent = ""; } catch (error) { const unavailable = error instanceof Error && error.message === "Global shortcut is unavailable"; setStatus(unavailable ? labels.shortcutUnavailable : labels.unavailable); if (unavailable) shortcutStatus.textContent = labels.shortcutUnavailable; } finally { setBusy(false); } };
      const applyPreferences = (value) => { document.getElementById("desktop-launch-at-login").checked = Boolean(value.launchAtLogin); document.getElementById("desktop-show-in-menu-bar").checked = Boolean(value.showInMenuBar); const dock = document.getElementById("desktop-show-in-dock"); if (dock) dock.checked = Boolean(value.showInDock); document.getElementById("desktop-notifications").checked = Boolean(value.notifications); document.getElementById("desktop-automatic-download").checked = Boolean(value.automaticDownload); document.getElementById("desktop-global-shortcut").value = value.globalShortcut || "Alt+Space"; };
      const loadPreferences = async () => { try { applyPreferences(await api.preferences.get()); const languageMode = await api.language.getMode(); document.getElementById("desktop-language").value = languageMode; document.querySelector("input[name='desktop-theme'][value='${currentTheme}']").checked = true; } catch { setStatus(labels.unavailable); } };
      const loadDiagnostics = async () => { try { const value = await api.diagnostics.get(); document.getElementById("desktop-diagnostics").textContent = JSON.stringify(value, null, 2); } catch { document.getElementById("desktop-diagnostics").textContent = labels.unavailable; } };
      document.getElementById("desktop-language").addEventListener("change", async (event) => { const value = event.target.value; setBusy(true); try { await api.language.set(value); window.location.reload(); } catch { setStatus(labels.unavailable); setBusy(false); } });
      document.getElementById("desktop-launch-at-login").addEventListener("change", (event) => void setPreferences({ launchAtLogin: event.target.checked }));
      document.getElementById("desktop-show-in-menu-bar").addEventListener("change", (event) => void setPreferences({ showInMenuBar: event.target.checked }));
      const dock = document.getElementById("desktop-show-in-dock"); if (dock) dock.addEventListener("change", (event) => void setPreferences({ showInDock: event.target.checked }));
      document.getElementById("desktop-notifications").addEventListener("change", (event) => void setPreferences({ notifications: event.target.checked }));
      document.getElementById("desktop-automatic-download").addEventListener("change", (event) => void setPreferences({ automaticDownload: event.target.checked }));
      const shortcut = document.getElementById("desktop-global-shortcut"); shortcut.addEventListener("keydown", (event) => { event.preventDefault(); const parts = []; if (event.metaKey) parts.push("Command"); else if (event.ctrlKey) parts.push("CommandOrControl"); if (event.altKey) parts.push("Alt"); if (event.shiftKey) parts.push("Shift"); const key = event.key.length === 1 ? event.key.toUpperCase() : ({ " ": "Space", Escape: "Escape", Enter: "Enter", Tab: "Tab" }[event.key] || event.key); if (parts.length && key) void setPreferences({ globalShortcut: parts.concat(key).join("+") }); });
      document.querySelectorAll("input[name='desktop-theme']").forEach((control) => control.addEventListener("change", async (event) => { setBusy(true); try { await api.theme.set(event.target.value); window.location.reload(); } catch { setStatus(labels.unavailable); setBusy(false); } }));
      document.getElementById("desktop-check-for-updates").addEventListener("click", async (event) => { const button = event.currentTarget; if (button.disabled) return; setButtonBusy(button, true); setBusy(true); try { await api.updates.check(); } finally { setBusy(false); setButtonBusy(button, false); } });
      document.getElementById("desktop-copy-diagnostics").addEventListener("click", async (event) => { const button = event.currentTarget; if (button.disabled) return; setButtonBusy(button, true); try { await navigator.clipboard.writeText(document.getElementById("desktop-diagnostics").textContent); setStatus(labels.copied); } catch { setStatus(labels.unavailable); } finally { setButtonBusy(button, false); } });
      document.getElementById("desktop-reset").addEventListener("click", async (event) => { const button = event.currentTarget; if (button.disabled) return; setButtonBusy(button, true); setBusy(true); setStatus(labels.saving); try { applyPreferences(await api.preferences.reset()); await api.language.set("system"); await api.theme.set("system"); window.location.reload(); } catch { setStatus(labels.unavailable); setBusy(false); setButtonBusy(button, false); } });
      api.language.onChanged(() => window.location.reload());
      void api.settings.ready();
      void loadPreferences();
    </script>
  </body>
</html>`;
}
