# Third-Party Notices

This extension includes third-party software whose license terms apply
independently of the MIT License covering TitanSystems' own extension code.

## TypeScript

This extension includes a modified version of TypeScript 6.0.3.

- Project: https://github.com/microsoft/TypeScript
- Copyright: Microsoft Corporation and contributors.
- License: Apache License, Version 2.0.
- Base commit: `050880ce59e30b356b686bd3144efe24f875ebc8`
- Bundled compiler: `vendor/typescript.js`
- License text: `vendor/LICENSE.typescript.txt`
- Upstream third-party notices: `vendor/ThirdPartyNoticeText.txt`
- Modification patch: `vendor/typescript-siebel.patch`

### Modifications

The bundled compiler has been modified to support Siebel eScript analysis.
These changes introduce the `siebelEScript` compiler option and adapt name
resolution, type checking, and language-service behavior for typed `with`
scopes. The parser also accepts Siebel eScript `&`-prefixed reference
parameters while exposing their unprefixed names to the language service.

The bundled compiler is a modified distribution, not an unmodified
Microsoft release.

The extension's MIT License does not replace the Apache License 2.0 terms
applicable to TypeScript. The accompanying TypeScript license, applicable
copyright notices, and upstream third-party notices must be retained when
redistributing the bundled compiler.

## Siebel type declarations

The file `types/siebel.d.ts` contains the Siebel API type declarations
provided for this project. These declarations are separate from the
TypeScript compiler and are not covered by TypeScript's Apache License.

Their inclusion does not grant rights to Oracle or Siebel software,
documentation, or other third-party materials.

## Project affiliation

This extension is an independent project. Its inclusion of TypeScript
and its support for Siebel eScript do not imply sponsorship, endorsement,
or affiliation with Microsoft or Oracle.
