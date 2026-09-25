# Siebel eScript (ST)

Language support for **Siebel eScript** in Visual Studio Code. The extension adds Siebel-aware IntelliSense, diagnostics, navigation, formatting, and support for scripts split across multiple files.

> **Pre-release:** This extension is under active development. Type definitions and diagnostics may still change before the first stable release.

## Features

- Syntax highlighting and a dedicated icon for `.escript` files
- Siebel API completion with signatures and inline documentation
- Type-aware completion inside `with` blocks
- Shared functions, variables, and objects across `.escript` files in the same directory
- Optional `this` type declarations through function header comments
- Hover information, signature help, Go to Definition, and Find All References
- Live syntax and type diagnostics
- Document formatting, outline, and code folding
- Built-in Siebel and ST runtime declarations
- Automatic workspace-wide project declarations from `.d.escript` files
- Support for project-specific `.d.ts` declaration files
- Native eScript types such as `chars`, `float`, and `bool`
- Siebel reference parameters declared with an `&` prefix
- Server-side `Clib` APIs and the `Buffer`, `ClibTime`, and `ClibDivisionResult` types

No Node.js installation, `tsconfig.json`, or workspace TypeScript installation is required.

## Getting Started

1. Install **Siebel eScript (ST)** from the Visual Studio Marketplace.
2. Open a folder containing your Siebel scripts.
3. Open or create a file with the `.escript` extension.
4. Start typing or press `Ctrl+Space` to open IntelliSense.

If VS Code selects the wrong language mode, click the language indicator in the status bar and choose **Siebel eScript**.

## Writing Typed eScript

Use Siebel eScript type names in source files:

```typescript
function Service_PreInvokeMethod(
    MethodName: chars,
    Inputs: PropertySet,
    Outputs: PropertySet
): Number {
    var bo: BusObject = TheApplication().GetBusObject("Account");
    var bc: BusComp = bo.GetBusComp("Account");

    with (bc) {
        ActivateField("Name");
        SetViewMode(AllView);
        ClearToQuery();
        ExecuteQuery(ForwardOnly);

        if (FirstRecord()) {
            Outputs.SetProperty("Name", GetFieldValue("Name"));
        }
    }

    return CancelOperation;
}
```

Inside `with (bc)`, suggestions are based on `BusComp`. Hover, parameter information, and diagnostics use the same type information.

### Supported types

- Primitive types: `chars`, `float`, and `bool`
- Runtime types: `Object`, `String`, `Number`, `Boolean`, `Array`, `Function`, `Date`, and `RegExp`
- Siebel types: `Application`, `BusObject`, `BusComp`, `Service`, `PropertySet`, and others

TypeScript-only types and constructs are not valid eScript. Use `chars` instead of `string`, `float` instead of `number`, and `bool` instead of `boolean`. For an untyped variable, omit its type instead of writing `any`.

The runtime annotations `String`, `Number`, and `Boolean` use the corresponding primitive eScript semantics. Values declared as `Number` therefore support arithmetic and compound operators such as `+`, `-`, `+=`, and `-=`.

`null` can be assigned to typed variables, passed to typed parameters, and returned from typed functions without adding a nullable type annotation.

### Reference parameters

Prefix a function parameter with `&` to use Siebel eScript pass-by-reference syntax:

```typescript
function UpdateStatus(recordId: chars, &status: chars) {
    status = "Processed: " + recordId;
}
```

Inside the function, use the parameter without the prefix—in this example, `status`. Completion, diagnostics, navigation, references, and signature help treat it as a normal local parameter. The `&` belongs only in the function declaration; calls use the regular argument syntax.

### Clib and buffers

The server-side `Clib` object includes declarations for Oracle-documented file and directory operations, file I/O, string and memory operations, mathematics, date and time handling, character classification, error handling, and array search and sorting. Related declarations include `FilePointer`, `Buffer`, `ClibTime`, and `ClibDivisionResult`.

```typescript
var file: FilePointer = Clib.fopen("C:\\temp\\result.txt", "wt");
Clib.fputs("Done", file);
Clib.fclose(file);

var now: ClibTime = Clib.localtime(Clib.time());
var buffer: Buffer = new Buffer(128, true, false);
buffer.putString(Clib.asctime(now));
```

`Clib` is a server-side API and is not available in Browser Script. Individual methods can also differ between Windows and UNIX; validate operating-system-dependent behavior in the target Siebel environment.

## Working with Multiple Files

All `.escript` files in the same directory form one script context. Top-level functions, variables, and objects can be used from any sibling file.

For example, `Shared.escript` can define:

```typescript
var QueueName: chars = "ReceiveQueue";

function CreateMessage(): PropertySet {
    return TheApplication().NewPropertySet();
}
```

Another file in the same directory can use both declarations directly:

```typescript
var message: PropertySet = CreateMessage();
message.SetProperty("Queue", QueueName);
```

Completion, navigation, references, and diagnostics work across these sibling files. Subdirectories are separate contexts. Duplicate top-level declarations in the same directory are reported as conflicts.

### Declaration scripts

Use a `.d.escript` file anywhere in the workspace to extend the available types without adding executable code. These files use declaration-file validation, so interfaces and declaration-only types such as `void` are accepted:

```typescript
interface Clib {
    WriteLn(arg: String): void;
}
```

The declarations are automatically available to every `.escript` file in the workspace, regardless of its directory. Normal `.escript` source files still share executable declarations only with files in the same directory. Unlike configured `.d.ts` files, `.d.escript` files do not need to be listed in the settings.

## Declaring the Type of `this`

Siebel often supplies the value of `this` at runtime, so its type cannot always be inferred from the source. Add a comment immediately above a function to declare it:

```typescript
// @this: Service
function Receive(Inputs: PropertySet, Outputs: PropertySet) {
    this.InvokeMethod("Receive", Inputs, Outputs);
}
```

The preferred syntax is `// @this: Type`. These alternatives are also supported:

```typescript
// @this = Service
// this: Service
```

The declaration applies only to the function directly below the comment. IntelliSense for `this` combines:

- Members of the declared type, such as methods from `Service`
- Top-level functions from the current file and all sibling `.escript` files
- Top-level variables and objects from the current file and all sibling `.escript` files

Example:

```typescript
var QueueName: chars = "ReceiveQueue";

// @this: Service
function Receive(Inputs: PropertySet, Outputs: PropertySet) {
    this.InvokeMethod("Receive", Inputs, Outputs); // Service member
    this.CreateMessage();                          // Function from a sibling file
    var queue: chars = this.QueueName;             // Top-level variable
}
```

The named type must exist in the built-in declarations or in a configured custom declaration file. Without a header comment, `this` remains intentionally untyped.

## Configuration

The built-in Siebel and runtime declarations are loaded automatically.

| Setting | Default | Description |
| --- | --- | --- |
| `escript.strict` | `true` | Enables strict type checking. This does not enable JavaScript runtime strict mode. |
| `escript.maxProblems` | `100` | Maximum number of diagnostics shown per file. |
| `escript.typeDefinitionFiles` | `[]` | Workspace-relative `.d.ts` files containing project-specific declarations. |

Example `.vscode/settings.json`:

```json
{
  "escript.strict": true,
  "escript.maxProblems": 100,
  "escript.typeDefinitionFiles": [
    "types/company.d.ts"
  ]
}
```

Configured `.d.ts` files must be listed explicitly. Imports, npm type packages, and triple-slash references are not resolved automatically. A `.d.ts` or `.d.escript` file supplies editor type information and is never executed.

## Command

Use **Siebel eScript: Restart Language Service** from the Command Palette after changing declaration files or when suggestions appear stale.

## Troubleshooting

| Problem | Suggested action |
| --- | --- |
| No suggestions or diagnostics | Confirm that the file uses the **Siebel eScript** language mode, then restart the language service. |
| Sibling declarations are missing | Make sure the files have the `.escript` extension and are located in exactly the same directory. |
| A global declaration is missing | Make sure the file ends with `.d.escript`, is inside the open workspace, and then restart the language service. |
| `this` members are missing | Place `// @this: Type` immediately above the function and verify that the type name is available. |
| A custom type is missing | Check the path in `escript.typeDefinitionFiles` and open **View → Output → Siebel eScript** for errors. |
| The file icon is not visible | The active VS Code file icon theme decides whether language-provided icons are displayed. |

To force the file association, add this to your VS Code settings:

```json
{
  "files.associations": {
    "*.escript": "escript"
  }
}
```

## Current Limitations

- The extension does not connect to a Siebel server, execute scripts, or deploy repository objects.
- Object-dependent `this` types are not inferred automatically; use `// @this: Type`.
- Browser, Node.js, and modern ECMAScript globals such as `window`, `Promise`, and `Map` are intentionally excluded.
- Some BLOB, conversion, and less common Siebel APIs may not yet be fully described.
- Static analysis complements, but does not replace, validation in the target Siebel environment.

## Feedback

This is a pre-release. Please report missing APIs, unexpected diagnostics, and reproducible bugs in the [GitHub issue tracker](https://github.com/TitanSystems-DE/TitanSystems.Siebel.VSCode.LanguageExtension/issues).

Include a small `.escript` example, the expected result, the actual result, and your VS Code version where possible.

## License

See [LICENSE](LICENSE). Bundled third-party components retain their respective licenses and notices.
