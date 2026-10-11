@AGENTS.md

# Project notes

- Site content lives in `src/data/*.ts`. Edit data there rather than in components.
- Never publish fabricated results, unapproved creators, or unconfirmed prices: keep `published: false` / empty `price` until the owner confirms. See README section 8.
- "200社超" is the number of companies proposed to (not contracts); "約50人" is creators in the network (not registered members).
- Forms: `src/app/api/{contact,partner}/route.ts` → `src/lib/form-handler.ts` → `src/lib/mail.ts`. Never show success unless the server actually sent the mail.
- Before committing: `npm run lint && npm run typecheck && npm run build`.
