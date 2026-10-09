# Shared platform contracts

This directory contains platform-neutral Kitezh contracts used by the web renderer, Electron
renderer, and React Native mobile client.

Keep this layer free of DOM, Electron, React Native, Bootstrap, and Node.js dependencies. It is
the home for semantic design tokens, icon names, locale types, translation keys, and API models
that can be shared safely. Native clients also consume platform contracts for console names,
update states, language modes, and social-provider availability. Platform adapters remain in
`src/main/web`, `src/main/desktop`, and `src/main/mobile`.

The web theme, Electron main process, and mobile foundation consume these contracts through the
`@kitezh/shared` package. Platform-specific components remain in their client packages; this
package is intentionally limited to contracts that can be consumed without DOM, Electron, or
React Native runtime dependencies.
