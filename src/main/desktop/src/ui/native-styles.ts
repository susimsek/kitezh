import {
  colors,
  controlSizes,
  radii,
  spacing,
  typography,
} from "@kitezh/shared/theme/runtime";

export function nativeDialogVariables(dark: boolean) {
  const palette = dark ? colors.dark : colors.light;
  return {
    "--dialog-background": palette.background,
    "--dialog-foreground": palette.text,
    "--dialog-secondary": palette.textMuted,
    "--dialog-button": palette.surfaceMuted,
    "--dialog-button-hover": palette.surfaceHover,
    "--dialog-border": palette.border,
    "--dialog-surface": palette.surface,
    "--dialog-primary": palette.primary,
    "--dialog-primary-hover": palette.primaryPressed,
    "--dialog-on-primary": palette.onPrimary,
    "--dialog-danger": palette.danger,
    "--dialog-on-danger": dark ? colors.light.text : colors.light.surface,
    "--dialog-control-compact": `${controlSizes.desktopCompact}px`,
    "--dialog-control-default": `${controlSizes.desktopDefault}px`,
    "--dialog-page-title": `${typography.pageTitle}px`,
    "--dialog-body-size": `${typography.body}px`,
    "--dialog-space-sm": `${spacing.sm}px`,
    "--dialog-space-md": `${spacing.md}px`,
    "--dialog-space-lg": `${spacing.lg}px`,
    "--dialog-radius-sm": `${radii.sm}px`,
    "--dialog-radius-md": `${radii.md}px`,
  };
}

export function nativeDialogCss(dark: boolean) {
  const variables = Object.entries(nativeDialogVariables(dark))
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n");
  return `
    :root {
      color-scheme: ${dark ? "dark" : "light"};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      ${variables}
    }
    * { box-sizing: border-box; }
    body { overflow-wrap: anywhere; }
    main, section { min-width: 0; }
    button {
      min-height: var(--dialog-control-default);
      max-width: 100%;
      padding: var(--dialog-space-sm) var(--dialog-space-md);
      border: 1px solid transparent;
      border-radius: var(--dialog-radius-sm);
      background: var(--dialog-primary);
      color: var(--dialog-on-primary);
      font: inherit;
      font-weight: 600;
      line-height: 1.5;
      white-space: normal;
      cursor: pointer;
    }
    button:hover { background: var(--dialog-primary-hover); }
    button.secondary { background: var(--dialog-button); color: var(--dialog-foreground); }
    button.secondary:hover { background: var(--dialog-button-hover); }
    button.danger { background: var(--dialog-danger); color: var(--dialog-on-danger); }
    button:disabled { opacity: .65; cursor: not-allowed; }
    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      margin-inline-end: var(--dialog-space-sm);
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      vertical-align: -2px;
      animation: native-spin .7s linear infinite;
    }
    @keyframes native-spin { to { transform: rotate(360deg); } }
    footer { flex-wrap: wrap; }
    :where(button, input, select, textarea, a, [tabindex]):focus-visible {
      outline: 2px solid var(--dialog-primary);
      outline-offset: 2px;
    }
    .update-layout {
      width: 100%;
      display: grid;
      grid-template-columns: 88px minmax(0, 1fr);
      gap: var(--dialog-space-lg);
      align-items: center;
      padding: var(--dialog-space-lg);
    }
    .update-layout img { width: 88px; height: 88px; border-radius: var(--dialog-radius-md); }
    .update-layout h1, .update-confirmation h1 {
      margin: 0 0 var(--dialog-space-md);
      font-size: var(--dialog-page-title);
      line-height: 1.25;
    }
    .update-layout p, .update-confirmation p {
      margin: 0;
      font-size: var(--dialog-body-size);
      line-height: 1.5;
      color: var(--dialog-secondary);
    }
    .update-layout label {
      display: flex;
      align-items: flex-start;
      gap: var(--dialog-space-sm);
      margin-top: var(--dialog-space-md);
    }
    .update-layout input { flex-shrink: 0; accent-color: var(--dialog-primary); }
    .update-layout footer { grid-column: 2; padding: 0; }
    .update-confirmation { padding: var(--dialog-space-lg); }
    .update-confirmation img { width: 64px; height: 64px; margin-bottom: var(--dialog-space-md); }
    .update-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--dialog-space-sm);
      padding: 0 var(--dialog-space-lg) var(--dialog-space-lg);
    }
    .update-check-cancel { display: block; margin: var(--dialog-space-lg) 0 0 auto; }
    @media (max-width: 520px) {
      .update-layout { grid-template-columns: minmax(0, 1fr); }
      .update-layout footer { grid-column: 1; }
      .update-actions button { flex: 1 1 100%; }
    }
    @media (forced-colors: active) {
      :root {
        --dialog-background: Canvas !important;
        --dialog-surface: Canvas !important;
        --dialog-foreground: CanvasText !important;
        --dialog-secondary: CanvasText !important;
        --dialog-border: CanvasText !important;
        --dialog-button: ButtonFace !important;
        --dialog-button-hover: ButtonFace !important;
        --dialog-primary: Highlight !important;
        --dialog-primary-hover: Highlight !important;
        --dialog-on-primary: HighlightText !important;
        --dialog-danger: ButtonFace !important;
        --dialog-on-danger: ButtonText !important;
      }
      :where(button, input, select, textarea, a, [tabindex]):focus-visible { outline-color: Highlight; }
      :where(button, input, select, textarea) {
        border: 1px solid ButtonText !important;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: .01ms !important;
      }
    }
  `;
}

export function nativeDialogActionsScript() {
  return `<script>
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") window.close();
    });
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-async]");
      if (!button) return;
      if (button.disabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      for (const action of document.querySelectorAll("button")) action.disabled = true;
      button.setAttribute("aria-busy", "true");
      const spinner = document.createElement("span");
      spinner.className = "spinner";
      spinner.setAttribute("aria-hidden", "true");
      button.prepend(spinner);
    }, true);
  </script>`;
}
