export type UpdateDialogLocale = "en" | "tr";

type CommonDialogOptions = {
  appName: string;
  iconDataUrl: string;
  language: UpdateDialogLocale;
  themeCss: string;
  actionsScript: string;
};

export function getUpdateCheckingCopy(language: UpdateDialogLocale) {
  const isTurkish = language === "tr";
  return {
    windowTitle: isTurkish ? "Yazılım Güncellemesi" : "Software Update",
    checkingLabel: isTurkish
      ? "Güncellemeler denetleniyor…"
      : "Checking for updates…",
    cancelLabel: isTurkish ? "İptal" : "Cancel",
  };
}

export function renderUpdateCheckingHtml(
  options: CommonDialogOptions & ReturnType<typeof getUpdateCheckingCopy>,
) {
  const { appName, iconDataUrl, themeCss, actionsScript, language } = options;
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${options.windowTitle}</title>
    <style>
      ${themeCss}
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }
      .progress { width: 100%; height: 12px; overflow: hidden; border-radius: var(--dialog-radius-sm); background: var(--dialog-border); }
      .progress::after { content: ""; display: block; width: 25%; height: 100%; background: var(--dialog-primary); animation: slide 1.35s ease-in-out infinite; }
      @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
    </style>
  </head>
  <body>
    <main class="update-layout">
      <img src="${iconDataUrl}" alt="${appName} logo">
      <section>
        <h1 id="update-check-title">${options.checkingLabel}</h1>
        <div class="progress" role="progressbar" aria-label="${options.checkingLabel}" aria-busy="true"></div>
        <button id="update-check-cancel" class="secondary update-check-cancel" type="button" onclick="window.close()">${options.cancelLabel}</button>
      </section>
    </main>
    ${actionsScript}
  </body>
</html>`;
}

export function getUpdateResultCopy(
  language: UpdateDialogLocale,
  appName: string,
  version: string,
) {
  const isTurkish = language === "tr";
  return {
    windowTitle: isTurkish ? "Yazılım Güncellemesi" : "Software Update",
    title: isTurkish ? `${appName} güncel` : `${appName} is up to date`,
    detail: isTurkish
      ? `${appName} için kullanılabilir yeni bir sürüm yok. ${version} sürümünü kullanıyorsunuz.`
      : `There are no new updates available for ${appName}. You are using version ${version}.`,
    doneLabel: isTurkish ? "Tamam" : "Done",
  };
}

export function renderUpdateResultHtml(
  options: CommonDialogOptions & ReturnType<typeof getUpdateResultCopy>,
) {
  const { appName, iconDataUrl, themeCss, actionsScript, language } = options;
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${options.windowTitle}</title>
    <style>
      ${themeCss}
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }

    </style>
  </head>
  <body>
    <main class="update-layout">
      <img src="${iconDataUrl}" alt="${appName} logo">
      <section>
        <h1 id="update-result-title">${options.title}</h1>
        <p id="update-result-detail">${options.detail}</p>
      </section>
      <footer class="update-actions"><button id="update-result-done" class="secondary" type="button" onclick="window.close()">${options.doneLabel}</button></footer>
    </main>
    ${actionsScript}
  </body>
</html>`;
}

export function getUpdateConfirmationCopy(
  language: UpdateDialogLocale,
  appName: string,
) {
  const isTurkish = language === "tr";
  return {
    title: isTurkish
      ? `${appName} şimdi güncellensin mi?`
      : `Update ${appName} now?`,
    detail: isTurkish
      ? `${appName}, güncellemeyi kurmak için kapanacak. Bu işlem bu makinedeki etkin yerel oturumları keser.`
      : `${appName} will quit to install the update, which will interrupt active local sessions on this machine.`,
    cancelLabel: isTurkish ? "İptal" : "Cancel",
    updateLabel: isTurkish ? "Güncelle" : "Update",
  };
}

export function renderUpdateConfirmationHtml(
  options: CommonDialogOptions &
    ReturnType<typeof getUpdateConfirmationCopy> & { desktopProtocol: string },
) {
  const {
    appName,
    iconDataUrl,
    themeCss,
    actionsScript,
    language,
    desktopProtocol,
  } = options;
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${options.title}</title>
    <style>
      ${themeCss}
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }

    </style>
  </head>
  <body>
    <main class="update-confirmation">
      <img src="${iconDataUrl}" alt="" aria-hidden="true">
      <h1 id="update-confirm-title">${options.title}</h1>
      <p id="update-confirm-detail">${options.detail}</p>
    </main>
    <footer class="update-actions">
      <button id="update-confirm-cancel" class="secondary" type="button" autofocus onclick="window.location.href='${desktopProtocol}://update-confirm/cancel'">${options.cancelLabel}</button>
      <button id="update-confirm-install" class="primary" type="button" data-async onclick="window.location.href='${desktopProtocol}://update-confirm/update'">${options.updateLabel}</button>
    </footer>
    ${actionsScript}
  </body>
</html>`;
}

export function getUpdateAvailableCopy(
  language: UpdateDialogLocale,
  appName: string,
  version: string | null,
  currentVersion: string,
) {
  const isTurkish = language === "tr";
  return isTurkish
    ? {
        title: `Yeni bir ${appName} sürümü var!`,
        detail: `${appName} ${version} kullanıma hazır; mevcut sürümünüz ${currentVersion}. Şimdi indirmek ister misiniz?`,
        automatic: "Gelecekteki güncellemeleri otomatik olarak indir ve kur",
        skip: "Bu sürümü atla",
        later: "Daha sonra hatırlat",
        install: "Güncellemeyi kur",
      }
    : {
        title: `A new version of ${appName} is available!`,
        detail: `${appName} ${version} is now available—you have ${currentVersion}. Would you like to download it now?`,
        automatic: "Automatically download and install updates in the future",
        skip: "Skip This Version",
        later: "Remind Me Later",
        install: "Install Update",
      };
}

export function renderUpdateAvailableHtml(
  options: CommonDialogOptions &
    ReturnType<typeof getUpdateAvailableCopy> & { desktopProtocol: string },
) {
  const {
    appName,
    iconDataUrl,
    themeCss,
    actionsScript,
    language,
    desktopProtocol,
  } = options;
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${options.title}</title>
    <style>
      ${themeCss}
      body { margin: 0; min-height: 100vh; background: var(--dialog-background); color: var(--dialog-foreground); }

    </style>
  </head>
  <body>
    <main class="update-layout">
      <img src="${iconDataUrl}" alt="${appName} logo">
      <section>
        <h1 id="update-title">${options.title}</h1>
        <p id="update-detail">${options.detail}</p>
        <label><input id="automatic" type="checkbox" checked><span id="automatic-label">${options.automatic}</span></label>
      </section>
    </main>
    <footer class="update-actions">
      <button id="skip-update" class="secondary" type="button" data-async onclick="window.location.href='${desktopProtocol}://update-action/skip?automatic=' + document.getElementById('automatic').checked">${options.skip}</button>
      <button id="remind-later" class="secondary" type="button" data-async onclick="window.location.href='${desktopProtocol}://update-action/later?automatic=' + document.getElementById('automatic').checked">${options.later}</button>
      <button id="install-update" class="primary" type="button" data-async onclick="window.location.href='${desktopProtocol}://update-action/download?automatic=' + document.getElementById('automatic').checked">${options.install}</button>
    </footer>
    ${actionsScript}
  </body>
</html>`;
}
