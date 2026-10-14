@AGENTS.md

# Project notes

- Service name is MIRATSUMU（ミラツム）; なまらグルメ is the operating media (stats, followers and history belong to it). Brand copy lives in `src/data/brand.ts`.
- Site content lives in `src/data/*.ts`. Edit data there rather than in components.
- Never publish fabricated results, unapproved creators, or unconfirmed prices: keep `published: false` / empty `price` until the owner confirms. See README section 8.
- Top stats (115万人超 total SNS followers of MIRATSUMU creators, 200店舗超 stores where PR was carried out, 売上200%UP = 200万円→600万円) were provided by the owner. "約50人" is creators in the network (not registered members).
- Forms: `src/app/api/{contact,partner}/route.ts` → `src/lib/form-handler.ts` → `src/lib/mail.ts`. Never show success unless the server actually sent the mail.
- Before committing: `npm run lint && npm run typecheck && npm run build`.
