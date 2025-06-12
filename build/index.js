#!/usr/bin/env node
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
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const fast_xml_parser_1 = require("fast-xml-parser");
// Define reusable schemas
const SearchRequestSchema = zod_1.z.object({
    searchTerm: zod_1.z.string(),
    limit: zod_1.z.number().optional().default(5).refine((val) => val >= 1 && val <= 50, {
        message: 'Limit must be between 1 and 50',
    }),
});
const GetFullXmlRequestSchema = zod_1.z.object({
    filePath: zod_1.z.string(),
});
// Replace hard-coded paths with configuration
const config = {
    directories: [
        process.env.RIMWORLD_CORE || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs',
        process.env.RIMWORLD_ROYALTY || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Royalty/Defs',
        process.env.RIMWORLD_IDEOLOGY || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Ideology/Defs',
        process.env.RIMWORLD_BIOTECH || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Biotech/Defs',
    ],
};
class RimWorldDefSearchServer {
    constructor() {
        this.indexedData = [];
        // Initialize XML parser
        this.parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });
        this.server = new index_js_1.Server({
            name: 'rimworld-def-search',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.indexFiles(); // Index files during startup
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', () => __awaiter(this, void 0, void 0, function* () {
            yield this.server.close();
            process.exit(0);
        }));
    }
    indexFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const directories = config.directories;
            const indexDirectory = (directory) => {
                const files = fs_1.default.existsSync(directory) ? fs_1.default.readdirSync(directory) : [];
                for (const file of files) {
                    const filePath = path_1.default.join(directory, file);
                    if (fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isDirectory()) {
                        indexDirectory(filePath); // Recursive call for subdirectories
                    }
                    else if (fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isFile() && file.endsWith('.xml')) {
                        const content = fs_1.default.readFileSync(filePath, 'utf-8');
                        this.indexedData.push({ file: `${filePath}`, content, relevance: 0 });
                    }
                }
            };
            for (const directory of directories) {
                indexDirectory(directory);
            }
            console.log(`Indexed ${this.indexedData.length} files.`);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, () => __awaiter(this, void 0, void 0, function* () {
            return ({
                tools: [
                    {
                        name: 'search',
                        description: 'Search RimWorld Def files for specific terms',
                        inputSchema: SearchRequestSchema,
                    },
                    {
                        name: 'getFullXml',
                        description: 'Retrieve the full XML content of a file',
                        inputSchema: GetFullXmlRequestSchema,
                    },
                ],
            });
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, (request) => __awaiter(this, void 0, void 0, function* () {
            if (request.params.name === 'getFullXml') {
                const args = request.params.arguments;
                const { filePath } = args;
                if (!fs_1.default.existsSync(filePath)) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, `File not found: ${filePath}`);
                }
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                const result = { file: filePath, content, relevance: 0 };
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            if (request.params.name === 'search') {
                const parsedArgs = SearchRequestSchema.safeParse(request.params.arguments);
                if (!parsedArgs.success) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidParams, parsedArgs.error.message);
                }
                const { searchTerm, limit } = parsedArgs.data;
                const results = yield this.performSearch(searchTerm);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(results.slice(0, limit), null, 2),
                        },
                    ],
                };
            }
            throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }));
    }
    // Extracts the full parent DOM tree containing the search term
    extractFullParentTree(xml, searchTerm) {
        const lowerXml = xml.toLowerCase();
        const lowerTerm = searchTerm.toLowerCase();
        let idx = lowerXml.indexOf(lowerTerm);
        if (idx === -1)
            return null;
        // Find all parent nodes leading up to the root
        const openTags = [];
        const closeTags = [];
        let pos = idx;
        while (pos >= 0) {
            const openTagMatch = lowerXml.lastIndexOf('<', pos);
            const closeTagMatch = lowerXml.indexOf('>', openTagMatch);
            if (openTagMatch !== -1 && closeTagMatch !== -1) {
                const tag = xml.substring(openTagMatch + 1, closeTagMatch).split(' ')[0];
                if (!tag.startsWith('/')) {
                    openTags.push(tag);
                }
                else {
                    closeTags.push(tag.substring(1));
                }
            }
            pos = openTagMatch - 1;
        }
        // Build the full parent tree
        const parentTree = openTags.reverse().map(tag => `<${tag}>`).join('') +
            xml.substring(idx, xml.indexOf('</', idx) + closeTags.length) +
            closeTags.map(tag => `</${tag}>`).join('');
        return parentTree;
    }
    // Update performSearch to build a pseudo-tree
    performSearch(searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchTerms = searchTerm.split(' ').filter(term => term.trim() !== '');
            const results = [];
            for (const data of this.indexedData) {
                const lowerContent = data.content.toLowerCase();
                let found = false;
                let bestTree = '';
                let bestPos = Infinity;
                for (const term of searchTerms) {
                    const idx = lowerContent.indexOf(term.toLowerCase());
                    if (idx !== -1 && idx < bestPos) {
                        // Try to extract the full parent DOM tree
                        const tree = this.extractFullParentTree(data.content, term);
                        if (tree) {
                            found = true;
                            bestTree = tree;
                            bestPos = idx;
                        }
                    }
                }
                if (found && bestTree) {
                    results.push({ file: data.file, content: bestTree, relevance: 1 });
                }
            }
            return results;
        });
    }
    // Helper to find nodes matching the search term
    findNodes(tree, term) {
        const nodes = [];
        const traverse = (node, parentKey = '') => {
            if (typeof node === 'object') {
                for (const key in node) {
                    if (key.includes(term) || (typeof node[key] === 'string' && node[key].includes(term))) {
                        nodes.push(`${parentKey}/${key}`);
                    }
                    traverse(node[key], key);
                }
            }
        };
        traverse(tree);
        return nodes;
    }
    // Helper to get parent node
    getParentNode(tree, node) {
        const traverse = (currentNode, parentNode) => {
            if (typeof currentNode === 'object') {
                for (const key in currentNode) {
                    if (key === node) {
                        return parentNode;
                    }
                    const result = traverse(currentNode[key], key);
                    if (result)
                        return result;
                }
            }
            return '';
        };
        return traverse(tree, '');
    }
    // Build an in-RAM tree or minimal index of nodes
    buildXmlIndex(directory) {
        return __awaiter(this, void 0, void 0, function* () {
            const index = {};
            const files = fs_1.default.existsSync(directory) ? fs_1.default.readdirSync(directory) : [];
            for (const file of files) {
                const filePath = path_1.default.join(directory, file);
                if (fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isDirectory()) {
                    const subIndex = yield this.buildXmlIndex(filePath);
                    Object.assign(index, subIndex); // Merge subdirectory index
                }
                else if (fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isFile() && file.endsWith('.xml')) {
                    const content = fs_1.default.readFileSync(filePath, 'utf-8');
                    const parsedXml = this.parser.parse(content);
                    index[filePath] = parsedXml; // Store parsed XML tree
                }
            }
            return index;
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new stdio_js_1.StdioServerTransport();
            yield this.server.connect(transport);
        });
    }
}
const server = new RimWorldDefSearchServer();
server.run().catch(console.error);
