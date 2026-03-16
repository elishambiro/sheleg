# Contributing to Sheleg

Thank you for your interest in contributing! Here's everything you need to get started.

## Getting Started

```bash
git clone https://github.com/your-org/sheleg.git
cd sheleg
npm install
npm run dev
```

## Development Workflow

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bug
   ```
3. **Make your changes**
4. **Run tests** before submitting:
   ```bash
   npm test
   ```
5. **Open a Pull Request** against `main`

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/...` | `feat/sub-annex-ui` |
| Bug fix | `fix/...` | `fix/pdf-page-count` |
| Docs | `docs/...` | `docs/contributing` |
| Refactor | `refactor/...` | `refactor/compiler` |

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add drag-to-reorder for sub-annexes
fix: correct page count for multi-page PDFs
docs: update build instructions for macOS
refactor: simplify compiler volume splitting
```

## Code Style

- **TypeScript** — strict mode, no `any` unless unavoidable
- **React** — functional components and hooks only
- **Tailwind** — utility classes, avoid custom CSS unless necessary
- **No comments** for self-evident code — write readable code instead

## Pull Request Guidelines

- Keep PRs **focused** — one feature or fix per PR
- Include a clear description of **what** and **why**
- If fixing a bug, describe how to reproduce it
- PRs that break the CI pipeline will not be merged

## Project Structure

```
src/
├── components/     # React UI components
├── services/       # Business logic (PDF compilation)
├── store/          # Zustand state management
├── hooks/          # Custom React hooks
├── lib/            # Infrastructure (IndexedDB, fonts)
├── utils/          # Pure utility functions
├── types/          # TypeScript type definitions
└── constants/      # App-wide constants
```

See [README.md](README.md) for a full architecture overview.

## Reporting Bugs

Please use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template.
Include the OS, app version, and steps to reproduce.

## Feature Requests

Please use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
