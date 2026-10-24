# Contributing to WorldGuard Lab

WorldGuard is a research prototype. Fixes should be submitted with reproducible seeds and automated tests. Contribution priorities:

1. Demonstrable safety failure cases and tests that catch them.
2. Transparent environment rules and explicit human approval boundaries.
3. Robust policies evaluated separately against task success and side effects.
4. Realistic domain models and constrained red-team behaviors contained in the sandbox.
5. Better accessibility, replay visualization, and support for different agent adapters.

Do not introduce any default integrations that interact with live infrastructure, accounts, personal data, external tools or autonomous destructive capabilities. Attach synthetic examples. Do not claim that a toy result proves real-world safety.

Run `npm test` and `npm run train` before opening a pull request. MIT license contributions are accepted under the project license.
