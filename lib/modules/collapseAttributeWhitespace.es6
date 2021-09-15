export const attributesWithLists = new Set([
    'class',
    'dropzone',
    'rel', // a, area, link
    'ping', // a, area
    'sandbox', // iframe
    'sizes', // link
    'headers' // td, th
]);

/** Collapse whitespaces inside list-like attributes (e.g. class, rel) */
export default function collapseAttributeWhitespace(tree) {
    tree.walk(node => {
        if (! node.attrs) {
            return node;
        }

        Object.entries(node.attrs).forEach(([attrName, attrValue]) => {
            const attrNameLower = attrName.toLowerCase();
            if (! attributesWithLists.has(attrNameLower)) {
                return;
            }

            const newAttrValue = attrValue.replace(/\s+/g, ' ').trim();
            node.attrs[attrName] = newAttrValue;
        });

        return node;
    });

    return tree;
}
