# Release template

Use this format for every release: **short, in English, no emojis**, grouped by
type and referencing the short commit hash (`git log <prev-tag>..HEAD --oneline`).

```markdown
## <version> (YYYY-MM-DD)

### Features
- <short description> (<commit-hash>)

### Bug Fixes
- <short description> (<commit-hash>)

### Refactor
- <short description> (<commit-hash>)

### Documentation
- <short description> (<commit-hash>)

### Chores
- <short description> (<commit-hash>)
```

## How to publish

```bash
# list commits since the previous release
git log v<prev>..HEAD --oneline

# create the release (tag is created on GitHub)
gh release create v<version> --title "<version>" --notes-file notes.md --target master
```

Notes:
- Omit sections that have no changes.
- Use conventional commit prefixes to fill the sections (`feat:`, `fix:`,
  `refactor:`, `docs:`, `chore:`).
- Keep each line a short imperative description, lowercase, no trailing period.
