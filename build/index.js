#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const fuzzy = __importStar(require("fuzzy"));
const net_1 = __importDefault(require("net"));
const zod_1 = require("zod");
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
    performSearch(searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            const searchTerms = searchTerm.split(' ').filter(term => term.trim() !== '');
            const results = this.indexedData
                .map((data) => {
                const lines = data.content.split('\n');
                let totalRelevance = 0;
                let matchCount = 0;
                const relatedTags = [];
                for (const term of searchTerms) {
                    const matches = fuzzy.filter(term, lines);
                    if (matches.length > 0) {
                        totalRelevance += matches.reduce((sum, match) => sum + match.score, 0) / matches.length;
                        matchCount++;
                        // Extract related XML tags for each match
                        matches.forEach(match => {
                            const lineIndex = match.index;
                            const contextLines = lines.slice(Math.max(0, lineIndex - 5), Math.min(lines.length, lineIndex + 5));
                            const xmlSnippet = contextLines.join('\n');
                            relatedTags.push(xmlSnippet);
                        });
                    }
                }
                if (matchCount > 0) {
                    const multiTermBoost = searchTerms.length > 1 ? (matchCount / searchTerms.length) : 1;
                    const relevance = totalRelevance * multiTermBoost;
                    return { file: data.file, content: relatedTags.join('\n'), relevance };
                }
                return null;
            })
                .filter((result) => result !== null);
            return results.sort((a, b) => b.relevance - a.relevance);
        });
    }
    findAvailablePort(startPort) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                const server = net_1.default.createServer();
                server.listen(startPort, () => {
                    server.close(() => resolve(startPort));
                });
                server.on('error', () => {
                    resolve(this.findAvailablePort(startPort + 1));
                });
            });
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const transport = new stdio_js_1.StdioServerTransport();
            yield this.server.connect(transport);
            const port = yield this.findAvailablePort(3000);
            console.error(`RimWorld Def Search MCP server running on port ${port}`);
        });
    }
}
const server = new RimWorldDefSearchServer();
server.run().catch(console.error);
