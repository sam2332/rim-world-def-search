"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performSearch = performSearch;
const xmlHelpers_1 = require("./xmlHelpers");
function performSearch(indexedData, searchTerm) {
    return __awaiter(this, void 0, void 0, function* () {
        const lowerTerm = searchTerm.toLowerCase();
        const results = [];
        const MAX_LEN = 1000;
        for (const data of indexedData) {
            const jsonTree = xmlHelpers_1.parser.parse(data.content);
            const nodes = findMatchingNodes(jsonTree, lowerTerm);
            if (nodes.length) {
                const snippetXml = xmlHelpers_1.builder.build(nodes[0]);
                const formattedSnippetXml = (0, xmlHelpers_1.formatXml)(snippetXml);
                let truncated = false;
                let content = formattedSnippetXml;
                if (formattedSnippetXml.length > MAX_LEN) {
                    content = formattedSnippetXml.slice(0, MAX_LEN) + '\n... [truncated, use Full Xml feature to see all]';
                    truncated = true;
                }
                results.push({
                    file: data.file,
                    content,
                    relevance: 1,
                    truncated,
                    fullXmlAvailable: truncated,
                });
            }
        }
        return results;
    });
}
function findMatchingNodes(obj, term) {
    const matches = [];
    const recurse = (node, parent = null) => {
        if (node && typeof node === 'object') {
            for (const key of Object.keys(node)) {
                if (key.startsWith('@_') && String(node[key]).toLowerCase().includes(term)) {
                    matches.push(parent || node);
                    break;
                }
            }
            for (const [k, v] of Object.entries(node)) {
                if (typeof v === 'string' && v.toLowerCase().includes(term)) {
                    matches.push(parent || node);
                    break;
                }
            }
            for (const [key, child] of Object.entries(node)) {
                recurse(child, node);
            }
        }
    };
    recurse(obj);
    return matches;
}
