# Unreleased

# 0.9.7

- Load every `.d.escript` file recursively from the workspace and make its declarations available to `.escript` files in all directories.
- Revalidate all active scripts when a global `.d.escript` file is created, changed, opened, closed, or deleted.
- Enforce separate scopes so normal `.escript` source sharing remains restricted to files in the same directory.
- Filter workspace declaration search results by the full `.d.escript` compound extension so ordinary `.escript` files can never become globally visible.
- Deduplicate Windows file URIs case-insensitively to prevent incorrect `Duplicate function implementation` diagnostics.
- Add regression coverage for workspace-global declarations, local source scope, live updates, and Windows URI deduplication.
- Document automatic workspace-wide `.d.escript` discovery and its distinction from configured `.d.ts` files.

# 0.9.6

- Validate `.d.escript` files as declaration files, allowing interfaces and declaration-only type syntax while making their types available to sibling scripts.
- Preserve source positions and navigation targets when resolving declarations from `.d.escript` files.
- Document automatic sibling `.d.escript` discovery and its distinction from configured `.d.ts` files.

# 0.9.5

- Support `&`-prefixed reference parameters in Siebel eScript function declarations.
- Resolve reference parameters under their unprefixed variable name for diagnostics, navigation, references, and signature help.
- Expand the documented server-side `Clib` API, including file, string, buffer, mathematical, time, character, error, search, and sort operations.
- Add `Buffer`, `ClibTime`, and `ClibDivisionResult` declarations.
- Treat source annotations `Number`, `String`, and `Boolean` as their primitive eScript equivalents so operators such as `+` and `+=` work correctly.
- Treat source annotations `Number`, `String`, and `Boolean` as their primitive eScript equivalents so operators such as `+` and `+=` work correctly.

# 0.9.4

- Add comment-based `this` declarations with `// @this: Type`, `// @this = Type`, and `// this: Type`.
- Add members of the declared Siebel type to `this` completion.
- Add top-level functions, variables, and objects from the current and sibling `.escript` files to `this` completion.
- Allow `null` assignments for all strongly typed eScript variables, parameters, and return values.
- Restrict source type annotations and IntelliSense to Siebel eScript-compatible types.
- Replace internal `Sbl*` aliases in public API signatures with native `chars`, `bool`, and `float` types and their supported object equivalents.
- Rewrite the Marketplace README with task-focused setup, usage examples, configuration, and troubleshooting guidance.

# 0.9.3

- Analyze `.escript` files in the same directory together so global functions, objects, navigation, references, and diagnostics work across files.

# 0.9.1

- Add a dedicated Marketplace icon and a matching transparent eScript file icon.

# 0.1.1

- Normalize Windows paths at the language-service host boundary so source files and built-in types are found.
- Add a regression test using simulated Windows paths and the actual TypeScript engine.
- Add light and dark file icons for the eScript language.

# 0.1.0

- Register `.escript` as the language Siebel eScript.
- Bundle the patched TypeScript 6.0.3 language service and supplied Siebel types.
- Add typed with-scope completions, hover, parameter hints and live diagnostics.
- Add definition, references, formatting, document outline and folding.
- Add explicit custom declaration files and isolated per-object script analysis.
