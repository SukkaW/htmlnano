import type PostHTML from 'posthtml';
import { isComment } from '../helpers';
import type { HtmlnanoModule, HtmlnanoOptions, PostHTMLTreeLike } from '../types';

const noWhitespaceCollapseElements = new Set([
    'script',
    'style',
    'pre',
    'textarea'
]);

const noTrimWhitespacesArroundElements = new Set([
    // non-empty tags that will maintain whitespace around them
    'a', 'abbr', 'acronym', 'b', 'bdi', 'bdo', 'big', 'button', 'cite', 'code', 'del', 'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'label', 'mark', 'math', 'nobr', 'object', 'q', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp', 'select', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'svg', 'textarea', 'time', 'tt', 'u', 'var',
    // self-closing tags that will maintain whitespace around them
    'comment', 'img', 'input', 'wbr'
]);

const noTrimWhitespacesInsideElements = new Set([
    // non-empty tags that will maintain whitespace within them
    'a', 'abbr', 'acronym', 'b', 'big', 'del', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'nobr', 'rp', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
]);

const startsWithWhitespacePattern = /^\s/;
const endsWithWhitespacePattern = /\s$/;
// See https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace and https://infra.spec.whatwg.org/#ascii-whitespace
const multipleWhitespacePattern = /[\t\n\f\r ]+/g;
const NONE = '';
const SINGLE_SPACE = ' ';
const validOptions = ['all', 'aggressive', 'conservative'];

type CollapseType = 'all' | 'aggressive' | 'conservative';
interface ParentInfo {
    node: PostHTML.Node;
    prevNode: PostHTML.Node | string | undefined;
    nextNode: PostHTML.Node | string | undefined;
}

/** Collapses redundant whitespaces */
function collapseWhitespace(tree: PostHTMLTreeLike, options: HtmlnanoOptions, collapseType: CollapseType, parent?: ParentInfo): PostHTMLTreeLike;
function collapseWhitespace(tree: Array<PostHTML.Node | string>, options: HtmlnanoOptions, collapseType: CollapseType, parent?: ParentInfo): Array<PostHTML.Node | string>;
function collapseWhitespace(tree: PostHTMLTreeLike | Array<PostHTML.Node | string>, options: HtmlnanoOptions, collapseType: CollapseType, parent?: ParentInfo) {
    collapseType = validOptions.includes(collapseType) ? collapseType : 'conservative';
    tree.forEach((node, index) => {
        const prevNode = tree[index - 1];
        const nextNode = tree[index + 1];

        if (typeof node === 'string') {
            const parentNodeTag = parent?.node.tag;
            const isTopLevel = parentNodeTag == null || parentNodeTag === 'html' || parentNodeTag === 'head';
            const shouldTrim = (
                isTopLevel
                || collapseType === 'all'
                /*
                 * When collapseType is set to 'aggressive', and the tag is not inside 'noTrimWhitespacesInsideElements'.
                 * the first & last space inside the tag will be trimmed
                 */
                || collapseType === 'aggressive'
            );

            node = collapseRedundantWhitespaces(node, collapseType, shouldTrim, parent, prevNode, nextNode);
        } else if (node.tag) {
            const isAllowCollapseWhitespace = !noWhitespaceCollapseElements.has(node.tag);
            if (isAllowCollapseWhitespace && node.content?.length) {
                node.content = collapseWhitespace(node.content, options, collapseType, {
                    node,
                    prevNode,
                    nextNode
                });
            }
        }
        tree[index] = node;
    });

    return tree;
}

function collapseRedundantWhitespaces(
    text: string, collapseType: CollapseType, shouldTrim = false, parent: ParentInfo | undefined,
    prevNode: PostHTML.Node | string, nextNode: PostHTML.Node | string
) {
    if (!text || text.length === 0) {
        return NONE;
    }

    if (!isComment(text)) {
        text = text.replace(multipleWhitespacePattern, SINGLE_SPACE);
    }

    if (shouldTrim) {
        // either all or top level, trim all
        if (collapseType === 'all' || collapseType === 'conservative') {
            return text.trim();
        }

        if (
            typeof parent !== 'object'
            || !parent?.node.tag
            || !noTrimWhitespacesInsideElements.has(parent.node.tag)
        ) {
            if (
                // It is the first child node of the parent
                !prevNode
                // It is not the first child node, and prevNode not a text node, and prevNode is safe to trim around
                || (
                    typeof prevNode === 'object' && prevNode.tag && !noTrimWhitespacesArroundElements.has(prevNode.tag))
            ) {
                text = text.trimStart();
            } else {
                // previous node is a "no trim whitespaces arround element"
                if (
                // but previous node ends with a whitespace
                    typeof prevNode === 'object' && prevNode.content
                ) {
                    const prevNodeLastContent = prevNode.content[prevNode.content.length - 1];
                    if (
                        typeof prevNodeLastContent === 'string'
                        && endsWithWhitespacePattern.test(prevNodeLastContent)
                        && (
                            !nextNode // either the current node is the last child of the parent
                            || (
                            // or the next node starts with a white space
                                typeof nextNode === 'object' && nextNode.content && typeof nextNode.content[0] === 'string'
                                && !startsWithWhitespacePattern.test(nextNode.content[0])
                            )
                        )
                    ) {
                        text = text.trimStart();
                    }
                }
            }
            if (
                !nextNode
                || typeof nextNode === 'object' && nextNode.tag && !noTrimWhitespacesArroundElements.has(nextNode.tag)
            ) {
                text = text.trimEnd();
            }
        } else {
            // now it is a textNode inside a "no trim whitespaces inside elements" node
            if (
                !prevNode // it the textnode is the first child of the node
                && startsWithWhitespacePattern.test(text[0]) // it starts with white space
                && typeof parent?.prevNode === 'string' // the prev of the node is a textNode as well
                && endsWithWhitespacePattern.test(parent.prevNode[parent.prevNode.length - 1]) // that prev is ends with a white
            ) {
                text = text.trimStart();
            }
        }
    }

    return text;
}

const mod: HtmlnanoModule<CollapseType> = {
    default: collapseWhitespace
} as HtmlnanoModule<CollapseType>;

export default mod;
