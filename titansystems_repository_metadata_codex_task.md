# Task: Repository-aware IntelliSense für TitanSystems Siebel eScript

## Ziel

Erweitere die TitanSystems Siebel-eScript-Extension um optionale
**Siebel Repository Metadata**.

Der Language Server soll dadurch kontextabhängige
IntelliSense-Vorschläge für Repository-Objekte liefern können,
insbesondere:

-   Business Objects
-   Business Components
-   Business Component Fields

Die Architektur muss von Anfang an mehrere Metadata-Provider
unterstützen.

Mindestens folgende Modi sollen vorgesehen werden:

1.  `none`
2.  `endoit`
3.  `native`

Der aktive Provider soll über die VS-Code-Einstellungen auswählbar sein.

Die bestehende eScript-Funktionalität darf dadurch nicht beeinträchtigt
werden.

------------------------------------------------------------------------

## 1. Bestehende Architektur zuerst untersuchen

Codex läuft bereits im Root-Verzeichnis des TitanSystems-Repositories.

Bevor Änderungen vorgenommen werden:

1.  Untersuche die bestehende Extension- und
    Language-Server-Architektur.
2.  Finde heraus:
    -   wo VS-Code-Konfiguration definiert wird,
    -   wie Client und Language Server kommunizieren,
    -   wo Completion implementiert ist,
    -   wie AST und Type Resolution funktionieren,
    -   wie `BusObject`, `BusComp`, `Service`, `PropertySet` usw.
        modelliert werden,
    -   wie Variablen-Typen propagiert werden,
    -   wie Function/Method Argument Completion momentan funktioniert.
3.  Verwende bestehende Abstraktionen und Patterns, sofern sinnvoll.
4.  Vermeide parallele/duplizierte Type-Systeme.

Die unten beschriebene Architektur ist ein Zielbild. Passe die konkrete
Implementierung an die vorhandene TitanSystems-Codebasis an.

------------------------------------------------------------------------

## 2. Endoit-Referenzimplementation untersuchen

Die Endoit-Extension befindet sich lokal unter:

``` text
D:\Projects\C#\gitrepo\siebelScriptsEditor
```

Diese Extension darf als Referenz untersucht werden.

Insbesondere relevant:

``` text
src/typegen/typeGenerator.ts
copy/object.d.ts.txt
copy/index.d.ts.txt
```

Endoit 3.1 generiert Repository-Metadaten für:

``` text
Business Object
    ↓
Business Components
    ↓
Fields
```

Endoit verwendet dafür TypeScript-Dateien.

Beispielsweise wird für einen Business Component ungefähr Folgendes
erzeugt:

``` typescript
const list = [
    "Id",
    "Name",
    "Account Status",
    "Primary Address"
] as const;

export type Fields = (typeof list)[number];
```

Die Dateien liegen sinngemäß unter:

``` text
types/<connection>/
    busobjects/
        Account.ts
        Contact.ts

    buscomps/
        Account.ts
        Contact.ts

    types.ts
```

`types.ts` bildet diese Dateien ungefähr so ab:

``` typescript
export type BusObjectBusComps = {
    "Account": import("./busobjects/Account").BusComps;
};

export type BusCompFields = {
    "Account": BusCompFieldType<
        import("./buscomps/Account").Fields
    >;
};
```

Zusätzlich existiert ein connection shim.

Untersuche die tatsächlichen aktuellen Pfade und Formate in der lokalen
Endoit-Codebasis und implementiere den Reader gegen die reale Struktur,
nicht ausschließlich gegen die Beispiele dieses Dokuments.

------------------------------------------------------------------------

## 3. MetadataProvider-Abstraktion

Führe eine interne Provider-Abstraktion für Repository-Metadaten ein.

Konzeptionell etwa:

``` typescript
interface SiebelMetadataProvider {
    getBusinessObjects(): Promise<string[]>;

    getBusinessComponents(
        businessObject?: string
    ): Promise<string[]>;

    getFields(
        businessComponent: string
    ): Promise<string[]>;

    getBusinessServices?(): Promise<string[]>;

    getServiceMethods?(
        service: string
    ): Promise<string[]>;

    getBusinessComponentMethods?(
        businessComponent: string
    ): Promise<string[]>;
}
```

Dies ist nur ein Architekturvorschlag.

Falls die bestehende TitanSystems-Architektur besser mit synchronen
APIs, Caches, Maps oder anderen Interfaces funktioniert, verwende die
passendere Form.

Wichtig ist die Trennung:

``` text
                eScript Language Server
                         │
                  Metadata API
                         │
          ┌──────────────┼──────────────┐
          │              │              │
        none           endoit         native
```

Completion und Type Resolution dürfen nicht direkt von
Endoit-spezifischen Dateien abhängig sein.

------------------------------------------------------------------------

## 4. Provider-Modi

### none

Keine Repository-Metadaten verwenden.

Die Extension verhält sich wie bisher.

Alle bestehenden Language Features müssen unverändert funktionieren.

### endoit

Die TitanSystems-Extension verwendet die von Endoit bereits
heruntergeladenen bzw. generierten Repository-Metadaten.

TitanSystems soll in diesem Modus **keine eigene Verbindung zu Siebel
aufbauen**.

Endoit bleibt verantwortlich für:

``` text
Siebel Connection
Authentication
Workspace
REST API
Metadata Download
```

TitanSystems ist verantwortlich für:

``` text
eScript Parsing
AST
Type Resolution
Diagnostics
Completion
Navigation
Repository-aware Completion
```

Die Kopplung zwischen den Extensions soll möglichst lose bleiben.

Wenn möglich:

-   keine direkte Runtime-Abhängigkeit von Endoit,
-   keine private Endoit-API voraussetzen,
-   stattdessen die generierten Metadata-/Type-Dateien lesen.

Falls Endoit einen stabileren offiziellen Mechanismus bereitstellt, kann
dieser bevorzugt werden.

### native

Dieser Provider soll die Architektur für eine spätere direkte
TitanSystems-Siebel-Anbindung bereitstellen.

Zielbild:

``` text
TitanSystems
     │
     ▼
Siebel REST API
     │
     ▼
Repository Metadata
```

Der Native Provider soll perspektivisch mindestens liefern können:

``` text
Business Objects
Business Components
Fields
Business Services
Service Methods
```

Falls eine vollständige Native-Implementierung für diesen Change zu groß
ist:

-   Provider-Interface und Factory vorbereiten,
-   `native` sauber kapseln,
-   noch nicht implementierte Features eindeutig behandeln,
-   keine Fake-Daten verwenden.

Priorität dieses Changes ist zunächst die funktionierende
Endoit-Integration.

------------------------------------------------------------------------

## 5. VS-Code-Konfiguration

Füge eine Einstellung hinzu, sinngemäß:

``` json
{
    "siebel-escript.metadataProvider": "endoit"
}
```

Mögliche Werte:

``` text
none
endoit
native
```

Bevorzugt als Workspace-fähige Einstellung.

Im VS-Code-Settings-UI soll eine verständliche Auswahl erscheinen.

Der Default sollte konservativ `none` sein, damit bestehende
Installationen ihr Verhalten nicht unerwartet ändern.

------------------------------------------------------------------------

## 6. Endoit Metadata Discovery

Implementiere eine robuste Erkennung der von Endoit erzeugten Metadaten.

Untersuche dafür insbesondere:

``` text
D:\Projects\C#\gitrepo\siebelScriptsEditor\src\typegen\typeGenerator.ts
```

Endoit verwendet unter anderem:

``` typescript
BusObjectBusComps
BusCompFields
```

und generiert einzelne Dateien für BOs und BCs.

TitanSystems sollte daraus intern beispielsweise folgende Strukturen
erzeugen:

``` typescript
Map<string, string[]> // BO -> BCs
Map<string, string[]> // BC -> Fields
```

Die TypeScript-Dateien von Endoit sollten möglichst **nicht mit
TypeScript evaluiert oder ausgeführt** werden.

Bevorzugt:

-   sicher parsen,
-   bekannte generierte Struktur lesen,
-   keine dynamische Code-Ausführung.

------------------------------------------------------------------------

## 7. Caching

Repository-Metadaten sollen nicht bei jeder Completion vollständig neu
von Disk gelesen werden.

Implementiere einen Cache.

Wenn sinnvoll, File-Watcher verwenden.

Änderungen an den Endoit-generierten Metadaten sollten anschließend ohne
VS-Code-Neustart übernommen werden.

------------------------------------------------------------------------

## 8. Business Object Completion

Bei:

``` javascript
TheApplication().GetBusObject("|
```

sollen bekannte Business Objects vorgeschlagen werden.

Dies gilt nur, wenn ein Metadata Provider entsprechende Informationen
bereitstellt.

Ohne Provider bleibt das bisherige Verhalten bestehen.

------------------------------------------------------------------------

## 9. Business Component Completion

Beispiel:

``` javascript
var bo = TheApplication().GetBusObject("Account");

bo.GetBusComp("|
```

Wenn bekannt ist:

``` text
bo = Business Object "Account"
```

sollen bevorzugt nur Business Components vorgeschlagen werden, die
diesem Business Object zugeordnet sind.

Falls der konkrete Business Object nicht ermittelt werden kann, kann --
sofern sinnvoll -- auf die Liste aller bekannten Business Components
zurückgefallen werden.

------------------------------------------------------------------------

## 10. Field Completion

Dies ist die wichtigste Funktion des ersten Changes.

Beispiel:

``` javascript
var bo = TheApplication().GetBusObject("Account");
var bc = bo.GetBusComp("Account");

bc.GetFieldValue("|
```

TitanSystems soll erkennen:

``` text
bc
 ↓
BusComp
 ↓
Repository Business Component = "Account"
```

und anschließend Felder aus den Repository-Metadaten anbieten.

Unterstütze mindestens:

``` text
ActivateField
GetFieldValue
GetFormattedFieldValue
SetFieldValue
SetFormattedFieldValue
SetSearchSpec
```

------------------------------------------------------------------------

## 11. Repository Identity zusätzlich zum eScript-Typ

Der normale eScript-Typ `BusComp` reicht hierfür nicht aus.

Der Language Server muss optional zusätzliche Repository-Informationen
verfolgen können.

Konzeptionell:

``` text
Type:
    BusComp

Repository Identity:
    Account
```

bzw. intern beispielsweise:

``` typescript
{
    type: "BusComp",
    repositoryName: "Account"
}
```

Die tatsächliche Implementierung soll zur bestehenden
Type-System-Architektur passen.

Diese Information sollte soweit sinnvoll durch einfache Zuweisungen
erhalten bleiben.

Beispiel:

``` javascript
var bc1 = bo.GetBusComp("Account");
var bc2 = bc1;

bc2.GetFieldValue("|
```

Hier sollte weiterhin `bc2 -> Account` bekannt sein.

------------------------------------------------------------------------

## 12. Keine falschen Diagnostics

Repository-Metadaten können unvollständig oder veraltet sein.

Deshalb Repository Metadata zunächst primär für **Completion**
verwenden.

Nicht automatisch Code als Fehler markieren, nur weil ein Feld nicht in
den lokal vorhandenen Repository-Metadaten enthalten ist.

Später kann optional ein konfigurierbarer Strict-Mode eingeführt werden.

------------------------------------------------------------------------

## 13. Vorbereitung für Business Services

Die Architektur soll bereits ermöglichen, später Folgendes zu
unterstützen:

``` javascript
var svc = TheApplication().GetService("My Service");

svc.InvokeMethod("|
```

Ziel:

``` text
GetService("My Service")
        ↓
Service Identity = "My Service"
        ↓
InvokeMethod(...)
        ↓
Methods dieses Business Service
```

Endoit stellt diese Method-Metadaten aktuell offenbar nicht bereit.

Deshalb muss dies für den Endoit Provider jetzt noch nicht
funktionieren.

Der Native Provider soll dies später ermöglichen können.

------------------------------------------------------------------------

## 14. Vorbereitung für BusComp InvokeMethod

Gleiches gilt perspektivisch für:

``` javascript
bc.InvokeMethod("|
```

Falls Repository-Metadaten entsprechende Methoden liefern können, soll
die Architektur diese Completion später unterstützen können.

Nicht hart in den Endoit Provider einbauen, wenn Endoit diese Daten
nicht liefert.

------------------------------------------------------------------------

## 15. Provider Capabilities

Da nicht jeder Provider alle Informationen liefern kann, sollte ein
Capability-Konzept vorgesehen werden.

Beispielsweise:

``` typescript
interface MetadataCapabilities {
    businessObjects: boolean;
    businessComponents: boolean;
    fields: boolean;
    businessServices: boolean;
    serviceMethods: boolean;
    businessComponentMethods: boolean;
}
```

Für Endoit derzeit ungefähr:

``` text
Business Objects             yes
Business Components          yes
Fields                       yes
Business Services            no
Service Methods              no
Business Component Methods   no
```

Native kann später mehr anbieten.

------------------------------------------------------------------------

## 16. Fehlerverhalten

Wenn `metadataProvider = endoit` eingestellt ist, aber keine
Endoit-Metadaten gefunden werden:

-   Language Server darf nicht abstürzen.
-   normale eScript-Features müssen funktionieren.
-   sinnvolle Log-/Output-Meldung erzeugen.
-   optional einmalige informative VS-Code-Meldung anzeigen.
-   keine Meldung bei jeder Completion wiederholen.

Gleiches gilt bei:

-   kaputten Metadata-Dateien,
-   teilweise vorhandenen Daten,
-   nicht mehr vorhandener Endoit-Installation,
-   wechselnder Connection,
-   wechselndem Workspace.

------------------------------------------------------------------------

## 17. Tests

Ergänze Tests für mindestens folgende Fälle.

### BO Completion

``` javascript
TheApplication().GetBusObject("|
```

liefert bekannte BOs.

### BC Completion

``` javascript
var bo = TheApplication().GetBusObject("Account");
bo.GetBusComp("|
```

liefert BCs des Account BO.

### Field Completion

``` javascript
var bc = bo.GetBusComp("Account");
bc.GetFieldValue("|
```

liefert Account-Felder.

### SetFieldValue

``` javascript
bc.SetFieldValue("|
```

liefert ebenfalls Account-Felder.

### Identity propagation

``` javascript
var bc1 = bo.GetBusComp("Account");
var bc2 = bc1;

bc2.GetFieldValue("|
```

liefert weiterhin Account-Felder.

### Unknown metadata

``` javascript
var bc = getSomethingAtRuntime();
bc.GetFieldValue("|
```

darf nicht crashen.

### Provider none

Alle bisherigen Tests und Features funktionieren unverändert.

------------------------------------------------------------------------

## 18. Bestehende Tests vollständig ausführen

Nach der Implementierung:

1.  vorhandene TitanSystems Tests ausführen,
2.  neue Tests ausführen,
3.  TypeScript/Lint/Build ausführen,
4.  auftretende Regressionen beheben.

Keine bestehenden Tests einfach deaktivieren oder Assertions
abschwächen, um die Änderung grün zu bekommen.

------------------------------------------------------------------------

## 19. Dokumentation

README bzw. passende Dokumentation ergänzen.

Dokumentiere die Modi:

``` text
none
endoit
native
```

Für Endoit erklären:

1.  Endoit Siebel Script And Web Template Editor installieren/verwenden.
2.  Repository-Metadaten dort herunterladen.
3.  TitanSystems Metadata Provider auf `endoit` stellen.
4.  `.escript`-Dateien erhalten daraufhin Repository-aware Completion.

Explizit erwähnen:

TitanSystems verwendet im Endoit-Modus die lokal erzeugten
Repository-Metadaten und baut keine eigene Siebel-Verbindung auf.

------------------------------------------------------------------------

## 20. Architekturziel

Am Ende soll die Architektur ungefähr so aussehen:

``` text
                     VS Code
                        │
                        ▼
              TitanSystems Extension
                        │
                        ▼
               eScript Language Server
                        │
             ┌──────────┴──────────┐
             │                     │
        eScript Engine       Metadata Layer
             │                     │
      Parser / AST            Provider API
      Type System                  │
      Symbols             ┌────────┼────────┐
      Diagnostics         │        │        │
      Completion        none    endoit    native
                                  │         │
                                  │         ▼
                                  │     Siebel REST
                                  │
                                  ▼
                          Endoit generated
                              metadata
```

Completion kombiniert:

``` text
eScript semantic information
            +
Siebel repository metadata
            │
            ▼
Repository-aware IntelliSense
```

------------------------------------------------------------------------

## 21. Wichtig: keine unnötige Endoit-Abhängigkeit

Die TitanSystems Extension soll **nicht zu einem Add-on für Endoit
werden**.

Endoit ist lediglich ein möglicher Metadata Provider.

Die Kernarchitektur muss unabhängig bleiben:

``` text
TitanSystems Language Server
            │
       Metadata API
            │
    beliebiger Provider
```

Damit können später weitere Quellen ergänzt werden, beispielsweise:

``` text
Endoit generated metadata
TitanSystems REST provider
exportierte Repository-Datei
lokaler Metadata Cache
andere Siebel tooling integrations
```

ohne Completion und Type System erneut umzubauen.

------------------------------------------------------------------------

## 22. Scope/Priorität für die erste Implementierung

### Priorität 1

-   bestehende Architektur analysieren
-   MetadataProvider-Abstraktion
-   Settings `none / endoit / native`
-   Endoit-Metadaten lesen
-   Cache
-   BO Completion
-   BC Completion
-   BC Field Completion
-   Repository Identity für `BusObject` und `BusComp`
-   Tests
-   Dokumentation

### Priorität 2

-   File Watching / automatische Aktualisierung
-   verbesserte Identity Propagation
-   bessere Fallback Completion

### Später

-   eigener TitanSystems REST Provider
-   Business Services
-   `GetService()` Completion
-   Service `InvokeMethod()` Completion
-   BusComp `InvokeMethod()` Completion
-   weitere Repository-Artefakte

------------------------------------------------------------------------

## 23. Vorgehen für Codex

Bitte nicht sofort blind implementieren.

Zuerst:

1.  TitanSystems-Codebasis untersuchen.
2.  Endoit-Codebasis unter `D:\Projects\C#\gitrepo\siebelScriptsEditor`
    untersuchen.
3.  Die tatsächlich erzeugten Endoit-Dateien und Pfade bestimmen.
4.  Relevante TitanSystems-Komponenten für Completion, AST und Type
    Resolution identifizieren.
5.  Einen kurzen Implementierungsplan anhand der real vorhandenen
    Klassen/Dateien erstellen.
6.  Danach implementieren.
7.  Tests ausführen.
8.  Build/Lint ausführen.
9.  Dokumentation aktualisieren.
10. Zum Abschluss kurz dokumentieren:
    -   welche Dateien geändert wurden,
    -   welche Architektur gewählt wurde,
    -   welche Features funktionieren,
    -   welche Teile für `native` nur vorbereitet wurden,
    -   welche Tests ausgeführt wurden.
