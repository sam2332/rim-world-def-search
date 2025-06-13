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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performSearch = performSearch;
const xmlHelpers_1 = require("./xmlHelpers");
const path_1 = __importDefault(require("path"));
function performSearch(indexedData, searchTerm) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
        const results = [];
        const MAX_LEN = 1000;
        for (const data of indexedData) {
            // Check if file name matches any of the search terms
            const fileName = path_1.default.basename(data.file).toLowerCase();
            const filePathLower = data.file.toLowerCase();
            let fileNameRelevance = 0;
            // Calculate filename relevance
            searchTerms.forEach(term => {
                if (fileName.includes(term)) {
                    fileNameRelevance += 2; // Higher relevance for filename match
                }
                else if (filePathLower.includes(term)) {
                    fileNameRelevance += 1; // Lower relevance for path match
                }
            });
            // Check content for matches
            const jsonTree = xmlHelpers_1.parser.parse(data.content);
            const matchingNodes = [];
            // Find all nodes that match any search term
            searchTerms.forEach(term => {
                const nodes = findMatchingNodes(jsonTree, term);
                nodes.forEach(node => {
                    const existingMatch = matchingNodes.find(m => m.node === node);
                    if (existingMatch) {
                        existingMatch.matchedTerms.push(term);
                    }
                    else {
                        matchingNodes.push({ node, matchedTerms: [term] });
                    }
                });
            });
            // Sort matching nodes by how many search terms they match
            matchingNodes.sort((a, b) => b.matchedTerms.length - a.matchedTerms.length);
            if (matchingNodes.length || fileNameRelevance > 0) {
                let content = '';
                let truncated = false;
                const contentRelevance = matchingNodes.length > 0 ?
                    matchingNodes[0].matchedTerms.length : 0;
                // Calculate total relevance (file matches + content matches)
                const relevance = fileNameRelevance + contentRelevance;
                // Get content from the best matching node if any
                if (matchingNodes.length > 0) {
                    const snippetXml = xmlHelpers_1.builder.build(matchingNodes[0].node);
                    const formattedSnippetXml = (0, xmlHelpers_1.formatXml)(snippetXml);
                    content = formattedSnippetXml;
                    if (formattedSnippetXml.length > MAX_LEN) {
                        content = formattedSnippetXml.slice(0, MAX_LEN) + '\n... [truncated, use Full Xml feature to see all]';
                        truncated = true;
                    }
                }
                else {
                    content = "File matched by name/path only. Use Full Xml feature to see content.";
                    truncated = true;
                }
                results.push({
                    file: data.file,
                    content,
                    relevance,
                    truncated,
                    fullXmlAvailable: true,
                    matchedTerms: fileNameRelevance > 0 ?
                        [...new Set([...searchTerms.filter(t => fileName.includes(t)),
                                ...(((_a = matchingNodes[0]) === null || _a === void 0 ? void 0 : _a.matchedTerms) || [])])] :
                        ((_b = matchingNodes[0]) === null || _b === void 0 ? void 0 : _b.matchedTerms) || []
                });
            }
        }
        // Sort results by relevance (highest first)
        results.sort((a, b) => b.relevance - a.relevance);
        return results;
    });
}
function findMatchingNodes(obj, term) {
    const matches = [];
    const recurse = (node, parent = null) => {
        if (node && typeof node === 'object') {
            // Check attribute values (starting with @_)
            for (const key of Object.keys(node)) {
                if (key.startsWith('@_') && String(node[key]).toLowerCase().includes(term)) {
                    matches.push(parent || node);
                    break;
                }
            }
            // Check text values
            for (const [k, v] of Object.entries(node)) {
                if (typeof v === 'string' && v.toLowerCase().includes(term)) {
                    matches.push(parent || node);
                    break;
                }
            }
            // Recursively check child nodes
            for (const [key, child] of Object.entries(node)) {
                recurse(child, node);
            }
        }
    };
    recurse(obj);
    return matches;
}
