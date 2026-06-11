## 1. Fix account extraction regex in parseTerminalInput

- [x] 1.1 Change regex from `/@([\w\s]+?)(?=\s+[@#]|\s+to\s+|fee:|$)/gi` to `/@([\w-]+)/g` — captures only word chars (no spaces) and supports hyphens
- [x] 1.2 Remove unused `accounts` post-processing `.map()` that strips `@` prefix and trims (no longer needed since `\w+` has no whitespace)

## 2. Improve resolveAccountId with prefix matching

- [x] 2.1 Add prefix match fallback: if exact lookup fails, scan accounts for names starting with the parsed token (case-insensitive, first match wins)
- [x] 2.2 Keep exact match priority over prefix match
- [x] 2.3 Keep fallback to `accounts[0]?.id` when nothing matches

## 3. Verify

- [x] 3.1 Run `npm run build` to confirm zero TypeScript errors and lints pass
- [x] 3.2 Manual smoke test: type `-50 @Cash Coffee #food` and confirm staging shows "Cash" not the first account
