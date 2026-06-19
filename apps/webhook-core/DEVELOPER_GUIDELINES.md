# CHINCHA FLOW Webhook Developer Guidelines

## Working Principles
1. **Minimal Changes** - Only modify what's necessary
2. **Consistency** - Follow existing code style/conventions
3. **Security** - Never expose secrets in code
4. **Documentation** - Keep docs updated with changes

## Best Practices
- Use TypeScript for all new features
- Write unit tests for critical functions
- Validate all webhook inputs
- Use Firebase logging for debugging

## Commit Rules
- Prefix with `feat:`, `fix:`, or `docs:`
- Keep messages under 72 chars
- Reference related issues

## PR Process
1. Create feature branch from `main`
2. Open PR with clear title/description
3. Get approval from senior dev
4. Deploy after merge