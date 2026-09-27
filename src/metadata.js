'use strict';

const EMPTY_CAPABILITIES = Object.freeze({
    businessObjects: false, businessComponents: false, fields: false,
    businessServices: false, serviceMethods: false, businessComponentMethods: false,
});
const ENDOIT_CAPABILITIES = Object.freeze({
    ...EMPTY_CAPABILITIES, businessObjects: true, businessComponents: true, fields: true,
});

const emptySnapshot = capabilities => ({
    capabilities, businessObjects: [], businessComponents: new Map(), fields: new Map(),
});

class NoneMetadataProvider {
    constructor() { this.capabilities = EMPTY_CAPABILITIES; }
    async snapshot() { return emptySnapshot(this.capabilities); }
    invalidate() {}
}

// Reserved provider boundary for a future direct Siebel REST implementation.
class NativeMetadataProvider extends NoneMetadataProvider {}

function decodeStringList(text) {
    const match = /^\s*const\s+list\s*=\s*(\[[\s\S]*?\])\s+as\s+const\s*;/m.exec(text);
    if (!match) return [];
    try {
        const value = JSON.parse(match[1]);
        return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : [];
    } catch { return []; }
}

function referencedNames(text, section, folder) {
    const block = new RegExp(`export\\s+type\\s+${section}\\s*=\\s*\\{([\\s\\S]*?)\\};`).exec(text)?.[1] || '';
    const result = [];
    const pattern = new RegExp(`^[ \\t]*(["'])(.*?)\\1\\s*:\\s*(?:BusCompFieldType<)?import\\(["']\\./${folder}/([^"']+)["']\\)`, 'gm');
    for (const match of block.matchAll(pattern)) result.push({ name: match[2], file: match[3] });
    return result;
}

class EndoitMetadataProvider {
    constructor(workspaceUri, fs, log = () => {}) {
        this.workspaceUri = workspaceUri;
        this.fs = fs;
        this.log = log;
        this.capabilities = ENDOIT_CAPABILITIES;
        this.cached = undefined;
        this.reportedMissing = false;
    }
    invalidate() { this.cached = undefined; }
    snapshot() { return this.cached ??= this.load(); }
    async read(uri) { return Buffer.from(await this.fs.readFile(uri)).toString('utf8'); }
    async load() {
        const empty = emptySnapshot(this.capabilities);
        if (!this.workspaceUri) return empty;
        try {
            const shimUri = this.join(this.workspaceUri, 'connection-shim.ts');
            const shim = await this.read(shimUri);
            const match = /from\s+["']\.\/types\/([^"']+)\/types["']/.exec(shim);
            if (!match || match[1].split(/[\\/]/).includes('..')) throw new Error('connection-shim.ts does not reference generated Endoit types');
            const root = this.join(this.workspaceUri, 'types', ...match[1].split('/'));
            const index = await this.read(this.join(root, 'types.ts'));
            const boRefs = referencedNames(index, 'BusObjectBusComps', 'busobjects');
            const bcRefs = referencedNames(index, 'BusCompFields', 'buscomps');
            const safeRefs = refs => refs.filter(ref => !/[\\/]/.test(ref.file) && ref.file !== '..' && ref.file !== '.');
            const businessComponents = new Map();
            const fields = new Map();
            await Promise.all(safeRefs(boRefs).map(async ref => {
                try { businessComponents.set(ref.name, decodeStringList(await this.read(this.join(root, 'busobjects', `${ref.file}.ts`)))); }
                catch (error) { this.log(`[Metadata] Cannot read Business Object ${ref.name}: ${error.message || error}`); }
            }));
            await Promise.all(safeRefs(bcRefs).map(async ref => {
                try { fields.set(ref.name, decodeStringList(await this.read(this.join(root, 'buscomps', `${ref.file}.ts`)))); }
                catch (error) { this.log(`[Metadata] Cannot read Business Component ${ref.name}: ${error.message || error}`); }
            }));
            this.reportedMissing = false;
            this.log(`[Metadata] Loaded Endoit metadata: ${boRefs.length} Business Objects, ${bcRefs.length} Business Components.`);
            return { capabilities: this.capabilities, businessObjects: boRefs.map(ref => ref.name), businessComponents, fields };
        } catch (error) {
            if (!this.reportedMissing) {
                this.log(`[Metadata] Endoit metadata unavailable; standard eScript features remain active. ${error.message || error}`);
                this.reportedMissing = true;
            }
            return empty;
        }
    }
    join(base, ...parts) {
        // Injected by the extension to keep this provider testable without VS Code.
        return this.fs.joinPath(base, ...parts);
    }
}

function createMetadataProvider(mode, options = {}) {
    if (mode === 'endoit') return new EndoitMetadataProvider(options.workspaceUri, options.fs, options.log);
    if (mode === 'native') return new NativeMetadataProvider();
    return new NoneMetadataProvider();
}

module.exports = {
    EMPTY_CAPABILITIES, ENDOIT_CAPABILITIES, NoneMetadataProvider, NativeMetadataProvider,
    EndoitMetadataProvider, createMetadataProvider, decodeStringList, referencedNames,
};
