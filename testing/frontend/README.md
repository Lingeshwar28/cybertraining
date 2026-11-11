# Frontend browser tests (Playwright)

These scripts test `index.html` in a real Chromium browser. They click through every
role's journey (sign-in, 2FA, learner, module owner, administrator) and make 59 checks.
Result when last run: **59 / 59 passed**.

The tests run against `mock-server.js`, a small stand-in server that answers the same
API requests as the Spring Boot backend, so they do not need MySQL. The real backend is
tested separately by the JUnit tests in `src/test/java`.

## How to run (Node.js 18+)

```
cd testing/frontend
npm install
npx playwright install chromium
npm run mock          # terminal 1: starts the stand-in server on http://localhost:8090
npm test              # terminal 2: runs the 59 checks and prints PASS / FAIL for each
```

The stand-in server keeps its data in memory and the tests change it (for example they
turn on 2FA for a test account), so **stop and restart `npm run mock` before each test run**.
Screenshots of each step are saved in `shots/` and the results in `e2e-results.json`.

| File | Purpose |
|---|---|
| `e2e.js` | The test script (all 59 checks) |
| `mock-server.js` | Stand-in for the Spring Boot API, with test accounts |
| `react-entry.js`, `react-bundle.js` | Local copy of React so the tests work without internet |
