## Summary

<!-- Why this change, in a sentence. Then the smallest sketch that shows what
moved: a diff of the component/call tree, pseudocode of the new rule, or a
short file tree. Delete whichever doesn't apply. -->

```diff

```

## Evidence

<!-- Before/after. Screenshots for anything visual (desktop + 390px if the
toolbar, table or map changed). For domain rules, the test that now passes. -->

- **Before:**
- **After:**

`yarn check`: <!-- green / what failed -->

## Data rules

<!-- Delete if nothing here changed. Otherwise say which and that spec.md
matches: unit-aware filtering, MW eligibility, battery canonicalization,
unknown ≠ 0, date precision / no `new Date()`, lifecycle statuses, region ≠ state. -->

## Merge danger

**Door:** <!-- two-way (revert and move on) / one-way (URL params, API contract, deploy config) -->

**Blast radius:** <!-- one word, then a line: e.g. "toolbar" — layout at ≤640px; "URL" — old shared links; "API" — client/server contract -->

<!-- Shared URLs are a public contract: renaming or dropping a query param
breaks links people have already copied. Say so here if you did. -->
