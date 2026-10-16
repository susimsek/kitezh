export type DesktopCompanionHtmlOptions = {
  appName: string;
  iconDataUrl: string;
  language: "en" | "tr";
  themeCss: string;
};

export function renderDesktopCompanionHtml({
  appName,
  iconDataUrl,
  language,
  themeCss,
}: DesktopCompanionHtmlOptions) {
  const isTurkish = language === "tr";
  const labels = isTurkish
    ? {
        account: "Hesap Konsolu",
        admin: "Yönetim Konsolu",
        description: "Devam etmek istediğiniz konsolu seçin.",
        eyebrow: "GÜVENLİ ERİŞİM",
        loading: "Açılıyor…",
      }
    : {
        account: "Account Console",
        admin: "Admin Console",
        description: "Choose where you want to continue.",
        eyebrow: "CONTINUE SECURELY",
        loading: "Opening…",
      };
  return `<!doctype html>
<html lang="${isTurkish ? "tr" : "en"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${appName}</title>
    <style>
      ${themeCss}
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { display: grid; min-height: 100vh; place-items: center; padding: 2rem; }
      section { width: min(100%, 390px); text-align: center; }
      img { width: 76px; height: 76px; border-radius: 18px; margin-bottom: 1.25rem; }
      .eyebrow { color: var(--dialog-primary); font-size: .78rem; font-weight: 700; letter-spacing: .08em; }
      h1 { font-size: 1.65rem; margin: .6rem 0 .45rem; }
      p { color: var(--dialog-secondary); font-size: .98rem; margin: 0 0 1.5rem; }
      .actions { display: grid; gap: .75rem; }
      button { align-items: center; background: var(--dialog-primary); border: 0; border-radius: var(--dialog-radius-sm); color: var(--dialog-on-primary); cursor: pointer; display: flex; font: inherit; font-weight: 700; gap: .6rem; justify-content: center; min-height: var(--dialog-control-default); padding: var(--dialog-space-sm) var(--dialog-space-md); width: 100%; }
      button:hover { background: var(--dialog-primary-hover); }
      button:disabled { cursor: default; opacity: .65; }
      .spinner { animation: spin 800ms linear infinite; border: 2px solid color-mix(in srgb, var(--dialog-on-primary) 45%, transparent); border-radius: 50%; border-top-color: var(--dialog-on-primary); height: 16px; width: 16px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main aria-label="${labels.eyebrow}">
      <section aria-labelledby="companion-title">
        <img src="${iconDataUrl}" alt="${appName} logo">
        <div class="eyebrow">${labels.eyebrow}</div>
        <h1 id="companion-title">${appName}</h1>
        <p>${labels.description}</p>
        <div class="actions">
          <button type="button" data-console="admin">${labels.admin}</button>
          <button type="button" data-console="account">${labels.account}</button>
        </div>
      </section>
    </main>
    <script>
      const labels = ${JSON.stringify(labels)};
      let pending = false;
      for (const button of document.querySelectorAll("button[data-console]")) {
        button.addEventListener("click", async () => {
          if (pending) return;
          pending = true;
          for (const candidate of document.querySelectorAll("button[data-console]")) { candidate.disabled = true; candidate.setAttribute("aria-busy", "true"); }
          button.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + labels.loading;
          try {
            await window.desktopApi.companion.openConsole(button.dataset.console);
          } finally {
            pending = false;
            button.textContent = button.dataset.console === "admin" ? labels.admin : labels.account;
            for (const candidate of document.querySelectorAll("button[data-console]")) { candidate.disabled = false; candidate.removeAttribute("aria-busy"); }
          }
        });
      }
      document.addEventListener("keydown", (event) => { if (event.key === "Escape") window.close(); });
      window.desktopApi.language.onChanged(() => window.location.reload());
    </script>
  </body>
</html>`;
}
