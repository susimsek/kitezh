# Contributing

Thank you for helping improve Kitezh, the identity platform in this repository.

## Before you start

- Open an issue first for a substantial feature or behavior change.
- Keep changes focused and explain the user-visible behavior in the pull request.
- Do not include credentials, tokens, generated build output, or deployment-specific secrets.

## Development setup

Use Java 25 and the Maven Wrapper. The frontend uses the project-managed pnpm version.

```bash
./mvnw test
./mvnw verify
pnpm --dir src/main/frontend lint
pnpm --dir src/main/frontend typecheck
```

Run Kitezh locally with `./mvnw spring-boot:run`. The default development server
listens on port 9090.

## Pull requests

- Use a Conventional Commit style for commit messages (`feat`, `fix`, `docs`, `test`, `ci`,
  and similar prefixes).
- Run `./mvnw spotless:apply` before committing Java changes.
- Run the focused tests for the behavior you changed and include the verification commands in
  the pull request description.
- Update documentation, localized messages, API schemas, and tests when the public behavior
  changes.
- Keep security-sensitive changes covered by authorization and integration tests.

All contributions are reviewed under the project [Code of Conduct](CODE_OF_CONDUCT.md).
