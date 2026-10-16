export type DesktopLoginHtmlOptions = {
  appName: string;
  iconDataUrl: string;
  language: "en" | "tr";
  themeCss: string;
};

export function renderDesktopLoginHtml({
  appName,
  iconDataUrl,
  language,
  themeCss,
}: DesktopLoginHtmlOptions) {
  const isTurkish = language === "tr";
  const labels = isTurkish
    ? {
        eyebrow: "Güvenli şekilde devam edin",
        title: "Bir konsol seçin",
        description: "Devam etmek istediğiniz konsolu seçin.",
        admin: "Admin Console’a giriş yap",
        adminDescription: "Yönetim ve erişim kontrolü.",
        account: "Account Console’a giriş yap",
        accountDescription: "Profil ve hesap ayarları.",
        browserHint:
          "Parolanız tarayıcıda kalır ve masaüstü uygulamasında saklanmaz.",
        unavailable:
          "Güvenli oturum açma başlatılamadı. Bağlantınızı kontrol edip tekrar deneyin.",
        starting: "Tarayıcı açılıyor…",
      }
    : {
        eyebrow: "Continue securely",
        title: "Choose a console",
        description: "Select where you want to continue.",
        admin: "Sign in to Admin Console",
        adminDescription: "Administration and access control.",
        account: "Sign in to Account Console",
        accountDescription: "Profile and account settings.",
        browserHint:
          "Your password stays in the browser and is never stored by the desktop app.",
        unavailable:
          "Secure sign-in could not be started. Check your connection and try again.",
        starting: "Opening browser…",
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
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--dialog-background); color: var(--dialog-foreground); }
      main { width: 100%; max-width: 560px; padding: 42px 36px 34px; text-align: center; }
      img { width: 84px; height: 84px; border-radius: 20px; margin-bottom: 22px; }
      .eyebrow { color: var(--dialog-primary); font-size: 14px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      h1 { margin: 12px 0 8px; font-size: var(--dialog-page-title); line-height: 1.15; font-weight: 750; }
      .description { margin: 0 0 26px; color: var(--dialog-secondary); font-size: 16px; line-height: 1.45; }
      .option { margin-top: 14px; }
      button { width: 100%; min-height: var(--dialog-control-default); padding: var(--dialog-space-sm) var(--dialog-space-md); border: 1px solid transparent; border-radius: var(--dialog-radius-sm); background: var(--dialog-primary); color: var(--dialog-on-primary); font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
      button:hover { background: var(--dialog-primary-hover); }
      button:disabled { cursor: wait; opacity: .7; }
      .option p { margin: 8px 0 0; color: var(--dialog-secondary); font-size: 13px; line-height: 1.35; }
      .hint { margin: 28px 0 0; color: var(--dialog-secondary); font-size: 13px; line-height: 1.45; }
      .error { display: none; margin: 18px 0 0; padding: 11px 14px; border: 1px solid var(--dialog-danger); border-radius: 8px; color: var(--dialog-danger); font-size: 13px; line-height: 1.4; }
      .error.visible { display: block; }
      .status { display: none; margin: 18px 0 0; color: var(--dialog-secondary); font-size: 14px; }
      .status.visible { display: block; }
      .spinner { display: inline-block; width: 15px; height: 15px; margin-right: 8px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: -2px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <main>
      <img src="${iconDataUrl}" alt="${appName} logo">
      <div class="eyebrow">${labels.eyebrow}</div>
      <h1>${labels.title}</h1>
      <p class="description">${labels.description}</p>
      <div class="option">
        <button type="button" data-console="admin">${labels.admin}</button>
        <p>${labels.adminDescription}</p>
      </div>
      <div class="option">
        <button type="button" data-console="account">${labels.account}</button>
        <p>${labels.accountDescription}</p>
      </div>
      <p class="hint">${labels.browserHint}</p>
      <p id="status" class="status"><span class="spinner"></span>${labels.starting}</p>
      <p id="error" class="error">${labels.unavailable}</p>
    </main>
    <script>
      const buttons = [...document.querySelectorAll("button[data-console]")];
      const status = document.getElementById("status");
      const error = document.getElementById("error");
      function setPending(pending) {
        buttons.forEach((button) => { button.disabled = pending; });
        status.classList.toggle("visible", pending);
      }
      buttons.forEach((button) => button.addEventListener("click", async () => {
        setPending(true);
        error.classList.remove("visible");
        try {
          await window.desktopApi.auth.openConsole(button.dataset.console);
        } catch {
          setPending(false);
          error.classList.add("visible");
        }
      }));
      window.desktopApi.onAuthCallback(({ error: callbackError }) => {
        if (callbackError) {
          setPending(false);
          error.classList.add("visible");
        }
      });
      window.desktopApi.language.onChanged(() => window.location.reload());
    </script>
  </body>
</html>`;
}
