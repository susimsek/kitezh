# Mobile AI Agent Guidelines

These instructions apply to `src/main/mobile/**`. The repository-root `AGENTS.md` remains
applicable. The web rules in `src/main/web/AGENTS.md` and Electron rules in
`src/main/desktop/AGENTS.md` are references for shared behavior, but their DOM-, CSS-, or
Electron-specific implementation details do not apply directly to React Native.

## Purpose and parity

- The mobile application is a React Native client for the same Kitezh authorization server and
  application APIs.
- Use `WEB-MOBILE-FEATURE-MATRIX.md` as the parity checklist. A web feature is not complete for
  mobile until its mobile behavior, authorization rules, localized states, error states, and tests
  are represented in the matrix.
- Preserve behavior and security contracts across web, desktop, and mobile. Adapt layout and
  interaction patterns to native mobile conventions instead of copying HTML, Bootstrap classes,
  or desktop layouts literally.
- If a feature is absent from the current web/backend implementation, mark it as blocked or not
  available in the matrix. Do not invent a mobile-only version of a server feature.

## Scope and structure

- Keep all mobile-only source under `src/main/mobile`.
- Prefer this structure as the application grows:

  ```text
  src/main/mobile/
  ├── src/
  │   ├── api/              # typed mobile API adapters
  │   ├── auth/             # PKCE, session lifecycle, secure storage adapters
  │   ├── components/       # reusable native components
  │   ├── i18n/             # mobile i18n setup and locale persistence
  │   ├── navigation/       # authenticated and public navigation
  │   ├── screens/          # feature screens
  │   ├── theme/            # semantic tokens and theme provider
  │   └── types/            # mobile-only types
  ├── e2e/
  ├── package.json
  └── tsconfig.json
  ```

- Keep shared contracts and platform-neutral code in an explicitly shared location only after the
  dependency direction is clear. Mobile must not import browser-only modules, React-Bootstrap,
  Electron APIs, `window.desktopApi`, or DOM utilities.
- Do not edit generated output or build artifacts.

## UI and design system

- Bootstrap is the web/Electron renderer design system. React Native must use native components
  and typed styles, while matching the same semantic design tokens: colors, spacing, typography,
  radii, control sizes, focus/pressed states, and action meanings.
- Define tokens by meaning (`primary`, `surface`, `text`, `danger`, `border`, and so on), not by
  platform-specific CSS names. Map those tokens to Bootstrap on web and React Native styles on
  mobile.
- Support system, light, and dark themes. Theme changes must update the complete screen, remain
  readable in all states, and persist across app restarts.
- Support Turkish and English. Keep user-facing messages localized and keep both dictionaries
  aligned. Locale changes must update the current screen and persist according to the selected
  preference.
- Every asynchronous action must prevent duplicate submission, preserve its label, expose a
  visible inline progress indicator, and restore its normal state after completion or failure.
- Every icon-only control needs an accessible label and an adequate mobile touch target. Important
  actions must also have localized visible text where appropriate.
- Forms must use the mobile form/validation equivalent of the web contract: field-level messages,
  localized errors, first-invalid-field focus, server validation mapping, and clearing stale field
  errors when the field changes.
- Do not use hard-coded black/white theme colors or one-off spacing when a semantic token exists.
- Use the bundled native `BrandMark` for Kitezh product identity on mobile screens; do not substitute
  a generic shield icon or load the web logo over the network. Keep the iOS/Android launcher icons,
  Android adaptive icon layers, and light/dark splash screen aligned with the desktop product mark.

### Native visual standards

- Use the Web UI standards in `src/main/web/AGENTS.md` as the behavioral and semantic reference,
  not as a component or layout source. Follow native iOS/Android conventions and do not copy the
  Web markup, Bootstrap patterns, or desktop layouts literally. ChatGPT mobile is a reference for
  clear hierarchy, calm surfaces, compact navigation, and predictable touch behavior; do not copy
  its branding or force a pixel-identical layout.
- Give each screen one clear page title, a short supporting description only when it helps, and a
  consistent content inset. Respect safe areas and keyboard insets. Screens with long content must
  scroll; forms must keep the focused field and its validation message visible above the keyboard.
- Use the shared type scale consistently: page title 26–30, section title 18–20, body 15–16,
  supporting text 13–14 points. Keep line-height readable and avoid using small text for primary
  labels, navigation, or important status.
- Use a consistent 48–52 point height for primary controls and at least a 44 by 44 point target for
  icon-only controls. Keep labels, fields, buttons, and cards aligned to the same horizontal inset.
  Use the semantic spacing and radius tokens instead of per-screen values when they express the same
  role.
- Keep surfaces visually quiet: group related settings and data into one clearly bounded surface,
  avoid nested cards and extra outer frames, and use separators for rows within a group. Use filled
  semantic status treatments with readable foreground contrast in both themes.
- Use one visual treatment per action role across screens: primary for the main continuation/save
  action, secondary for navigation/cancel, and danger for destructive actions. Keep destructive
  confirmation explicit. Add a pressed state without reducing disabled/loading legibility.
- Reuse native screen headers, section headings, field treatments, empty/error/loading states, and
  account navigation rather than restyling each route independently. Preserve visible field labels;
  placeholders are hints, not labels. Keep field errors directly below their field and visibly
  distinguish invalid, focused, disabled, and read-only states.
- Keep layouts comfortable on compact phones and tablets. Allow localized Turkish text and larger
  accessibility text to wrap; do not truncate primary actions or force horizontal scrolling for
  ordinary forms and settings. Dense administrative tables may use an intentional native list or
  horizontal scrolling only when all actions remain reachable.
- Before accepting a visual change, inspect the affected native screen at a compact phone size and
  a larger phone/tablet size, in light and dark mode, with English and Turkish text. Check keyboard
  overlap, large text, focus/pressed/disabled states, and VoiceOver/TalkBack labels. Record or update
  a native E2E assertion when the screen behavior or layout constraint changes.

### iOS, iPadOS, and Android conventions

- Keep the Kitezh brand and shared semantic tokens consistent with Web and Desktop, while using
  native navigation, controls, and system behavior on each platform. Shared tokens define meaning;
  platform components decide how that meaning is presented.
- Prefer the iOS system font and Android's Roboto/system font defaults. Use a custom family only for
  a deliberate brand role; keep body text and controls in the OS-native family so Dynamic Type and
  Android font scaling remain predictable.
- **iOS:** use a predictable native back/navigation pattern and respect the system status bar,
  home indicator, safe areas, keyboard dismissal, and edge gestures. Use bottom tabs only for the
  app's persistent top-level destinations; use a native-feeling selected state and do not place the
  tab bar in a floating rounded card. Present short focused tasks as sheets and destructive
  confirmation with a native alert. Support Dynamic Type and VoiceOver without clipping or
  truncating labels. Follow Apple's guidance for
  [tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars),
  [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility),
  and [keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards/).
- **iPadOS:** do not stretch a phone form across the full display. Use a readable maximum content
  width; use a sidebar or split layout only when it improves navigation between persistent sections.
  Keep touch targets and safe-area behavior correct in portrait, landscape, and multitasking sizes.
- **Android:** follow Material 3 interaction conventions for controls, selection, navigation, and
  confirmation while retaining Kitezh's token values. Respect system Back and predictive Back,
  edge-to-edge insets, status/navigation bars, keyboard IME resizing, font scaling, and TalkBack.
  Use a bottom navigation bar on compact widths and a navigation rail only when the available
  width makes it useful. A visible app-bar back action on a nested screen must mirror Android
  system Back and predictive Back behavior. Follow the
  [Material 3 guidance](https://m3.material.io/).
- Use platform-aware back affordances, pressed feedback, and navigation semantics. A screen must
  not depend on a gesture alone: provide an accessible visible alternative where the OS pattern
  requires one. Respect reduced motion and do not encode selected, error, or success state by color
  alone.
- Treat accessibility text scaling as a layout input. Let headings, tab labels, form errors, and
  buttons wrap; allow scrolling instead of truncating or shrinking text. Keep interactive targets
  at least 44 points on iOS and 48 dp on Android, including icon-only actions.
- For tablet layouts, use a maximum readable content width and responsive columns rather than
  stretching cards and fields. For phones, keep the primary task visible without introducing
  horizontal scrolling.
- Before accepting a native UI change, validate the relevant iOS and Android behavior separately:
  safe areas/insets, system Back, keyboard/IME, status/navigation bars, light/dark/system theme,
  English/Turkish, compact and large text, touch targets, and VoiceOver/TalkBack. A shared Maestro
  flow may verify common behavior, but platform-specific behavior needs an assertion on each OS.

## Authentication and security

- Use Authorization Code + PKCE (S256) for mobile. The mobile OAuth client is public and must not
  contain a client secret.
- Register a mobile-specific client and redirect URI. Do not reuse desktop or browser client token
  records. Use a validated custom scheme or platform universal/app link configured by the server.
- Keep authorization state, PKCE verifier, callback validation, refresh, logout, and expiry
  handling in a focused authentication adapter. Consume callback state once and reject stale or
  mismatched callbacks.
- Store access, ID, and refresh tokens only in platform secure storage. Never store tokens in
  AsyncStorage, Redux, query strings, URLs, logs, analytics, or crash reports.
- Keep Admin and Account sessions separate, as they are on web and desktop. Never copy token sets
  between consoles.
- Refresh only when the access token is near expiry or an explicit retry requires it. Handle one
  authenticated retry for a 401, then clear the relevant session on permanent refresh failure.
- OIDC logout must use the ID-token hint and the registered mobile post-logout redirect URI.
- Backend authorization is authoritative. Mobile route visibility must not replace API
  authorization checks, and 401/403 responses must render a safe localized state.
- Never log provider responses, authorization codes, PKCE verifiers, access tokens, refresh tokens,
  ID tokens, or client secrets.

## API, data, and behavior

- Reuse the existing backend API contracts and Problem Detail behavior. Do not create a second
  backend flow merely to simplify the mobile UI.
- Keep API access in typed mobile adapters. Do not attach bearer tokens ad hoc in individual
  screens.
- Preserve pagination, filtering, sorting, validation, cache invalidation, audit, and session
  invalidation semantics of the web APIs.
- Do not expose persistence entities directly in mobile UI models. Map API responses to typed
  view models where needed.
- Show a page-level loading state before data-dependent controls, a localized empty state when no
  data exists, and a recoverable error state when a request fails.

## Testing and quality gates

- Required checks for mobile changes are typecheck, lint, unit/component tests, build, and native
  E2E tests appropriate to the selected React Native toolchain.
- Test observable behavior, not implementation details: successful flows, loading and duplicate
  submission prevention, validation, empty/error/401/403 states, theme and locale changes,
  reload/restart persistence, deep links, refresh, logout, and responsive/native layouts.
- Every new mobile feature must include parity coverage in the matrix and tests for the affected
  web-equivalent behavior where the backend contract is shared.
- Do not consider a web Playwright pass to be mobile E2E coverage. Native E2E must launch the
  mobile build and exercise the real navigation/authentication boundaries.
- Pull request and main CI run the same Maestro flows on headless iOS Simulator and Android
  Emulator jobs. Keep platform setup separate while reusing `e2e/maestro/*.yaml`; release workflows
  package a commit already validated by CI and do not rerun the full E2E suite.
- On macOS, run local iOS E2E with `bash e2e/run-ios-background.sh`; it boots, installs, and launches
  through `simctl`/`xcodebuild` without opening Simulator.app. On Android, run
  `bash e2e/run-android-background.sh` with a booted emulator; it uses `10.0.2.2` to reach host-side
  Metro and the fixture server. Do not use `expo run:ios` in the automated E2E path because it opens
  the Simulator desktop window.
- Run `git diff --check` after changes. Keep changes focused and do not commit, push, merge, or
  rewrite history without explicit user permission.

## Delivery checklist

- Update `WEB-MOBILE-FEATURE-MATRIX.md` when a feature changes status.
- Keep English and Turkish messages aligned.
- Verify light/dark themes, keyboard or screen-reader accessibility where supported, touch targets,
  long localized text, disabled/loading states, offline behavior, deep links, and logout.
- Document any intentional platform difference in the matrix instead of silently diverging.
- Before release, verify Android and iOS builds, secure storage, redirect registration, update
  configuration, and signed release behavior in their supported environments.
