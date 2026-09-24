# Siebel eScript (ST)

Language support for **Siebel eScript** in Visual Studio Code, with IntelliSense, type-aware `with` scopes, inline documentation, navigation, formatting, and live diagnostics.

> **Pre-release:** This is the first public preview. Some diagnostics, APIs, and type definitions may still be incomplete or change before the stable release. Feedback and bug reports are welcome.

## Highlights

- Syntax highlighting for `.escript` files
- IntelliSense and code completion for Siebel APIs
- Cross-file functions and objects within the same directory
- Type-aware completions inside `with` blocks
- Hover documentation and completion details from JSDoc
- Signature help and parameter information
- Live syntax and type diagnostics
- Go to Definition and Find All References
- Document formatting
- Document outline and code folding
- Built-in Siebel and ST runtime type definitions
- Support for additional workspace-specific `.d.ts` files
- Dedicated `.escript` file icon for light and dark themes

## Quick Start

1. Install **Siebel eScript (ST)** from the Visual Studio Marketplace.
2. Open a file with the `.escript` extension.
3. Start typing or press `Ctrl+Space` to display suggestions.

The extension includes its own language service and type definitions. Node.js, a `tsconfig.json`, and a workspace TypeScript installation are not required.

```typescript
function Service_PreInvokeMethod(
    MethodName: chars,
    Inputs: PropertySet,
    Outputs: PropertySet
): Number {
    if (MethodName != "FindAccount") return ContinueOperation;

    var bo: BusObject = TheApplication().GetBusObject("Account");
    var bc: BusComp = bo.GetBusComp("Account");

    with (bc) {
        ActivateField("Name");
        SetViewMode(AllView);
        ClearToQuery();
        SetSearchSpec("Name", Inputs.GetProperty("Name"));
        ExecuteQuery(ForwardOnly);

        if (FirstRecord()) {
            Outputs.SetProperty("Name", GetFieldValue("Name"));
        }
    }

    return CancelOperation;
}
```

Inside `with (bc)`, completion, hover, signature help, and diagnostics use the type of `bc`. This makes Siebel object scripts easier to explore and helps catch invalid method calls while editing.

## Configuration

The built-in Siebel and runtime declarations are loaded automatically.

| Setting | Default | Description |
| --- | --- | --- |
| `escript.strict` | `true` | Enables strict type checking for eScript analysis. This does not enable JavaScript runtime strict mode. |
| `escript.maxProblems` | `100` | Sets the maximum number of diagnostics reported per file. |
| `escript.typeDefinitionFiles` | `[]` | Adds workspace-relative `.d.ts` files with project-specific declarations. |

Example workspace configuration:

```json
{
  "escript.strict": true,
  "escript.maxProblems": 100,
  "escript.typeDefinitionFiles": [
    "types/company.d.ts"
  ]
}
```

Each additional declaration file must be listed explicitly. Imports, triple-slash references, and npm type packages are not resolved automatically. Declaration files provide type information only and are never executed.

## Commands

### Siebel eScript: Restart Language Service

Restarts the language service and reloads the configured type declarations. Use this command if suggestions or diagnostics appear stale after changing your configuration or declaration files.

## Analysis Model

All `.escript` files in the same directory are analyzed together. Global functions, variables, and objects declared in one file can be used from every other `.escript` file on that directory level. Completion, hover, Go to Definition, references, and diagnostics work across these files. Subdirectories form separate analysis contexts.

Because sibling files share a global scope, duplicate global declarations in the same directory are reported as conflicts.

The extension uses a customized TypeScript language service to model Siebel eScript and dynamic `with` scopes. It does not execute scripts, connect to a Siebel server, or deploy repository objects.

## Current Limitations

The bundled runtime profile is intentionally conservative. Browser, Node.js, and modern ECMAScript globals such as `window`, `Promise`, and `Map` are not included unless provided through a custom declaration file.

The following areas are not yet fully modeled:

- Object-dependent implicit `this` contexts
- Complete ST type-conversion behavior
- The full set of Clib, Buffer, and BLOB APIs
- Every TypeScript syntax construct that is unsupported by the Siebel runtime

Static analysis can improve editing confidence, but it is not a replacement for validation and testing in the target Siebel environment.

## Troubleshooting

| Problem | Suggested action |
| --- | --- |
| No suggestions or diagnostics | Confirm that the language mode is **Siebel eScript**, then run **Siebel eScript: Restart Language Service**. |
| A custom type file is not loaded | Verify that its path is workspace-relative and listed in `escript.typeDefinitionFiles`. Check **View → Output → Siebel eScript** for details. |
| Hover text is missing | Documentation is shown only when the corresponding declaration contains JSDoc. |
| A definition cannot be found | Dynamic members without a named declaration cannot provide a definition target. |
| The file icon is not displayed | File icon themes control whether language-provided icons are shown. |

If `*.escript` was previously associated with another language, update the association in your VS Code settings:

```json
{
  "files.associations": {
    "*.escript": "escript"
  }
}
```

## Feedback and Issues

This extension is currently in pre-release. Please report bugs, missing Siebel APIs, and unexpected behavior in the [GitHub issue tracker](https://github.com/TitanSystems-DE/TitanSystems.Siebel.VSCode.LanguageExtension/issues).

When reporting an issue, include a minimal eScript example, the expected behavior, the actual behavior, and your VS Code version where possible.

## License

See the [LICENSE](LICENSE) file for this extension's license. The bundled TypeScript compiler and other third-party components retain their respective licenses and notices.
