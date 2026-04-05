# Commit Message Guidelines

Follow these conventions for meaningful commit messages that improve project history.

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **refactor**: Code refactoring without feature changes
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Dependencies, build scripts, etc.
- **ci**: CI/CD configuration changes
- **deploy**: Deployment-related changes

## Examples

### Feature
```
feat(backend): add Prometheus metrics export

- Implement Counter for API requests
- Implement Gauge for simulation mode
- Add /metrics endpoint for Prometheus scraping
```

### Fix
```
fix(frontend): prevent duplicate alert popups

- Add previousAlertRef to track alert state changes
- Only trigger popup on state change, not every poll
```

### Deployment
```
deploy(ci-cd): add EC2 deployment stage

- Add deploy-to-ec2 GitHub Actions job
- Deploy via SSH with docker-compose restart
- Update image tags with git SHA
```

### Refactor
```
refactor(frontend): extract Alert component

- Create reusable AlertPopup component
- Improve component composition
- Reduce App.tsx complexity
```

## Tips

1. Use imperative mood ("add feature" not "added feature")
2. Limit subject line to 50 characters
3. Reference issues: `Fixes #123`
4. Keep body line width to 72 characters
5. Use Conventional Commits format: https://www.conventionalcommits.org/

## Generate Changelog

```bash
# View commits by type
git log --oneline | grep "^feat"
git log --oneline | grep "^fix"

# Create changelog
git log --grep="feat\|fix" --oneline > CHANGELOG.md
```
