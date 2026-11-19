'use strict';

const ENDOIT_EXTENSION_ID = 'endoIT.siebelscriptandwebtempeditor';
const THIS_TYPES = new Map([
    ['business service', 'Service'],
    ['business component', 'BusComp'],
    ['applet', 'WebApplet'],
    ['application', 'Application'],
]);

/**
 * Infers the Siebel runtime type of `this` from Endoit's on-disk layout:
 * <connection>/<workspace>/<object type>/<object>/<script>.
 */
function inferEndoitThisType(uri, workspaceUri) {
    if (!uri || !workspaceUri || uri.scheme !== workspaceUri.scheme || uri.authority !== workspaceUri.authority) return undefined;
    const workspacePath = decodeURIComponent(workspaceUri.path).replace(/\/+$/, '');
    const documentPath = decodeURIComponent(uri.path);
    const prefix = workspacePath ? `${workspacePath}/` : '/';
    if (!documentPath.toLowerCase().startsWith(prefix.toLowerCase())) return undefined;
    const relative = documentPath.slice(prefix.length).split('/').filter(Boolean);
    if (relative.length < 5) return undefined;
    return THIS_TYPES.get(relative.at(-3).toLowerCase());
}

module.exports = { ENDOIT_EXTENSION_ID, inferEndoitThisType };
