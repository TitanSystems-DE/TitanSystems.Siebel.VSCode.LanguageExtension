# Siebel eScript (ST) for Visual Studio Code

Source version: **0.1.1**. Language support for `.escript` files, including Siebel types, JSDoc documentation, and typed `with` scopes. The extension includes its own customized TypeScript 6.0.3 language service.

This source package has not yet been published under a confirmed Marketplace ID. The `siebel-escript-local` publisher in `package.json` is the existing development ID. Replace it with your actual publisher ID before publishing. `YOUR-PUBLISHER` and `YOUR-REPOSITORY` throughout this guide are placeholders.

## Installation for Users: VS Code Marketplace

Once the extension has been published:

1. Open VS Code version 1.85 or later.
2. Open the Extensions view with **Ctrl+Shift+X**.
3. Search for **Siebel eScript (ST)** and select the correct publisher.
4. Click **Install** and open an `.escript` file.
5. The language indicator in the lower-right corner should display **Siebel eScript**.

Alternatively, install the published extension from the Marketplace using:

```sh
code --install-extension YOUR-PUBLISHER.siebel-escript
```

Users do not need Node.js, npm, a `tsconfig.json`, or a workspace TypeScript version selection. Updates are managed through VS Code's extension manager.

Before switching to the final publisher, uninstall any previous installation of `siebel-escript-local.siebel-escript` to prevent both extensions from providing support for the same language.

If an existing setting associates `*.escript` with TypeScript, remove or update it:

```json
{
  "files.associations": { "*.escript": "escript" }
}
```

## Try It Out

```typescript
var bo: BusObject = TheApplication().GetBusObject("Account");
var bc: BusComp = bo.GetBusComp("Account");

with (bc) {
    ClearToQuery();
    SetSearchSpec("Name", "Acme");
    ExecuteQuery(ForwardOnly);

    var accountName: String = GetFieldValue("Name");
    ExecuteQuery("wrong"); // Intentional type error
}
```

- **IntelliSense:** Suggestions while typing or with Ctrl+Space, including inside `with` scopes.
- **Documentation:** Hover information and completion details based on JSDoc comments.
- **Parameter hints:** Signature help when starting a method call.
- **Diagnostics:** Syntax and type errors in the editor and Problems panel, updated as the document changes.
- **F12 / References:** Definitions and references in the current script and loaded declaration files.
- **Formatting:** Support for Format Document.
- **Outline / Folding:** Functions, variables, and code blocks.
- **Syntax highlighting:** The TypeScript grammar from VS Code's built-in language extension, extended with `bool`, `chars`, and `float`.

## Custom Type Definitions

The Siebel types and ST runtime profile are loaded automatically. There is no need to copy the original `index.d.ts` into the workspace again. Existing `tsconfig` files are not used for `.escript` analysis.

Additional type declarations can be configured explicitly:

```json
{
  "escript.typeDefinitionFiles": ["types/company.d.ts"],
  "escript.strict": true,
  "escript.maxProblems": 100
}
```

Paths are relative to the open workspace folder. Each additional file must be listed explicitly; automatic resolution of imports, triple-slash references, and npm types is not supported.

Changes to loaded `.d.ts` files are reflected in the analysis, including unsaved changes. Declarations provide type information only and are never executed.

Each `.escript` file is analyzed as a separate Siebel object script. Event handlers with identical names in different files therefore do not cause global naming conflicts. Shared type contracts should be defined in explicitly configured `.d.ts` files.

## Scope and Limitations

The `types/siebel.d.ts` file is an unchanged copy of the supplied, previously tested type declarations. It contains 14 interfaces. Existing descriptions appear in the editor; documentation is not generated for methods that have no descriptions.

`types/runtime.d.ts` replaces the standard DOM, Node.js, and ECMAScript libraries. Globals outside this profile, such as `Promise`, `Map`, and `window`, and members such as `String.includes`, are not offered. This is a conservative runtime profile, not proof that every omitted feature is unavailable in every Siebel version.

The analysis engine is not a Siebel compiler and does not execute scripts. ST aliases and dynamic `with` scopes are represented through static approximations.

The following areas are not yet fully modeled:

- The object-dependent implicit `this` context.
- Complete ST type-conversion behavior.
- The full set of Clib, Buffer, and BLOB APIs.
- Restrictions on every TypeScript syntax construct that is unsupported by Siebel.

The permissive index signatures for `Application` and `Service` in the supplied declarations are preserved.

## Project Structure and Architecture

| Path | Purpose |
| --- | --- |
| `package.json` | Extension manifest, language registration, settings, and npm commands |
| `package-lock.json` | Locked npm dependencies for `npm ci` |
| `src/extension.js` | VS Code adapter: activation, providers, diagnostics, and lifecycle management |
| `src/service.js` | One TypeScript language service per document, virtual file paths, and declaration files |
| `types/siebel.d.ts` | Unchanged supplied Siebel declarations |
| `types/runtime.d.ts` | Conservative ST runtime profile and primitive aliases |
| `vendor/typescript.js` | Executable, prepatched TypeScript compiler |
| `vendor/typescript-siebel.patch` | Changes relative to the specified TypeScript commit |
| `vendor/LICENSE.typescript.txt` | Apache 2.0 license for the compiler |
| `vendor/ThirdPartyNoticeText.txt` | Notices from the TypeScript project |
| `syntaxes/escript.tmLanguage.json` | TextMate grammar based on `source.ts` |
| `icons/` | Light and dark language/file icons |
| `test/` | Language-service tests, VS Code API simulation, and Windows path regression test |
| `examples/Account.escript` | Example script containing an intentional type error |
| `.vscodeignore` | Files excluded from the published extension package |

The adapter is currently written in **JavaScript (CommonJS)**. The Siebel type contracts are TypeScript declarations, and the compiler patch modifies TypeScript source code. There is therefore no transpilation step for `src/`.

Internally, each script is analyzed as a virtual `.ts` file without changing character positions. This allows hover information, diagnostics, and definitions to map directly to the original script.

No separate LSP process is started. The language service runs in the Node.js extension host. This distribution is not a web extension for a browser-only host. Scripts are neither executed nor transferred to a Siebel server.

## Developer Prerequisites

- **Node.js 22 or later:** The pinned `@vscode/vsce` 4.0.0 requires at least Node 22. This package was tested with Node 24.19.0.
- **npm and internet access** to install the development tools.
- **VS Code** for interactive extension-host testing.
- **Git** for optional compiler source reconstruction and version control.

Extract the ZIP into a working directory and open a terminal in the `siebel-escript-vscode` folder. The following commands work in PowerShell, Bash, and zsh.

## Build and Test

```sh
npm ci
npm test
npm run package
```

`npm ci` installs the development tools specified in the lockfile. `npm test` runs the tests using Node's built-in test runner. `npm run package` creates `siebel-escript-0.1.1.vsix` as the publication artifact. It does not install the extension.

All required runtime files are already included. A normal build therefore requires neither a global `tsc` installation nor a compiler rebuild.

The `--no-dependencies` packaging option is intentional: the compiler is bundled under `vendor/`, and no npm packages are required at runtime.

The existing packaging command includes `--allow-missing-repository` so the source package can be built without a placeholder repository URL. Once the actual repository has been configured, this option can be removed.

### Interactive Development

From the project directory:

```sh
code --extensionDevelopmentPath=.
```

Open an `.escript` file in the Extension Development Host. This is a development test; users install the published extension through the Marketplace.

Perform the following manual checks:

1. Inspect suggestions and documentation after typing `TheApplication().`.
2. Use F12 on `GetBusObject` and inspect its hover information.
3. Complete a method such as `SetSearchSpec` inside `with (bc)`.
4. Confirm that `ExecuteQuery("wrong")` produces a type error, then replace the argument with `ForwardOnly`.
5. Edit, close, and reopen a file; diagnostics should update accordingly.
6. Test on Windows and at least one other operating system, using both light and dark themes.

All ten automated tests passed for version 0.1.1. The Windows test simulates Windows paths at the language-service host boundary while using the actual TypeScript engine. It does not replace testing in a real Windows/Electron environment. A real extension-host test was not performed in the build environment.

## Publishing to the VS Code Marketplace

### 1. Publisher and Package Metadata

Create or select a publisher in the [Marketplace publisher portal](https://marketplace.visualstudio.com/manage). Enter its ID in the `publisher` field of `package.json`. The extension ID is formed from the publisher ID and package name: `<publisher>.<name>`.

Also configure the actual repository and support channel. Replace the placeholder values below:

```json
{
  "publisher": "YOUR-PUBLISHER",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git"
  },
  "homepage": "https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY#readme",
  "bugs": {
    "url": "https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY/issues"
  }
}
```

Keep the existing manifest fields. Do not use this snippet as a complete replacement for `package.json`.

Before publication, replace the placeholders in this README with the actual values and update the statement that publication is still pending.

`LICENSE.txt` describes the existing licensing arrangement. The compiler license and third-party notices remain part of the package. Before a public release, finalize the licensing of your own files and the supplied Siebel declarations. The package does not claim additional rights to those declarations.

### 2. Build and Upload the Package

```sh
npm ci
npm test
npm run package
```

Upload the generated VSIX through the publisher portal as a new **Visual Studio Code** extension. For subsequent releases, update the existing extension.

After successful publication, verify installation through the Marketplace using the instructions at the beginning of this README.

### 3. Automated Publishing

For CI, Microsoft recommends Microsoft Entra ID with Workload Identity Federation. The identity requires access to the publisher. Follow the official documentation linked below to configure authentication.

In an appropriately authenticated environment, run:

```sh
npx vsce publish --azure-credential --packagePath siebel-escript-0.1.1.vsix
```

This command publishes the previously tested package. It has not been executed for this source distribution. Do not store credentials in the repository.

According to Microsoft's documentation, global Azure DevOps Personal Access Tokens are being retired on **December 1, 2026**. Use Entra ID for new publishing automation.

### 4. Version Updates

Version 0.1.1 represents the current implementation. For a subsequent update:

```sh
npm version patch --no-git-tag-version
npm test
npm run package
```

Update the changelog and release notes. Use the newly generated filename when uploading or publishing from the command line. Keep the publisher ID and package name stable across future releases.

## Rebuilding the Patched TypeScript Compiler — Optional

This is only necessary if you want to modify the compiler logic or rebuild it from the original source. The supplied compiler is already included in the extension.

Base version: TypeScript **6.0.3**, commit `050880ce59e30b356b686bd3144efe24f875ebc8`.

Run the following commands from the project directory. `typescript-upstream` must be a new sibling directory:

```sh
git clone --branch v6.0.3 --depth 1 https://github.com/microsoft/TypeScript.git ../typescript-upstream
git -C ../typescript-upstream rev-parse HEAD
```

Compare the printed commit ID with the base commit above. Then run:

```sh
git -C ../typescript-upstream apply --check ../siebel-escript-vscode/vendor/typescript-siebel.patch
git -C ../typescript-upstream apply ../siebel-escript-vscode/vendor/typescript-siebel.patch
cd ../typescript-upstream
npm ci
npm run build:compiler
cd ../siebel-escript-vscode
node -e "require('node:fs').copyFileSync('../typescript-upstream/built/local/typescript.js', 'vendor/typescript.js')"
npm test
npm run package
```

If you rename the extracted project folder, adjust the relative paths accordingly.

The complete upstream source tree is obtained from the specified commit. This ZIP includes the executable compiler and the complete modification patch, rather than an additional copy of Microsoft's entire source tree.

Rebuilding depends on the availability of the upstream repository and its npm dependencies. Byte-for-byte identical output across different Node.js and build environments is not guaranteed.

The patch adds the `siebelEScript` option, includes properties of the `with` object in name resolution, and enables the corresponding checking and completion behavior. Without this option, normal TypeScript behavior is preserved.

Do not replace `vendor/typescript.js` with an unmodified TypeScript compiler from npm: doing so removes this functionality.

## Troubleshooting

| Symptom | What to Check |
| --- | --- |
| No suggestions | Verify that the language mode is **Siebel eScript**; run `Siebel eScript: Restart Language Service` |
| Missing documentation | The corresponding declaration must contain JSDoc comments |
| F12 finds no definition for `DoSomething` | Arbitrary or dynamic members have no named declaration; test with `GetBusObject` |
| Limited syntax highlighting | Check the built-in **TypeScript and JavaScript Language Basics** extension and the active color theme |
| No file icon | Language icons depend on the file icon theme; the icon is registered in `contributes.languages` |
| Custom types fail to load | Open **View → Output → Siebel eScript** and check workspace-relative paths |
| Packaging fails | Check the Node.js version, run `npm ci`, and verify the repository settings |
| No analysis on Windows with version 0.1.0 | Use version 0.1.1, which normalizes virtual paths at the language-service host boundary |

`typescript.tsdk` does not control this extension. Syntax highlighting uses TextMate; a dedicated semantic tokens provider has not been implemented.

## Official References

Publishing guidance reviewed on September 24, 2026:

- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [TypeScript Source Baseline](https://github.com/microsoft/TypeScript/tree/050880ce59e30b356b686bd3144efe24f875ebc8)