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
const fileIndex_1 = require("./utils/fileIndex");
const searchXml_1 = require("./utils/searchXml");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const zod_to_json_schema_1 = require("zod-to-json-schema");
const SearchRequestSchema = zod_1.z.object({
    searchTerm: zod_1.z.string(),
    limit: zod_1.z.number().optional().default(5).refine((val) => val >= 1 && val <= 50, {
        message: 'Limit must be between 1 and 50',
    }),
});
const GetFullXmlRequestSchema = zod_1.z.object({
    filePath: zod_1.z.string(),
});
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
        this.indexedData = (0, fileIndex_1.indexXmlFiles)(config.directories);
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', () => __awaiter(this, void 0, void 0, function* () {
            yield this.server.close();
            process.exit(0);
        }));
    }
    setupToolHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, () => __awaiter(this, void 0, void 0, function* () {
            return ({
                tools: [
                    {
                        name: 'search',
                        description: 'Search RimWorld Def files for specific terms',
                        inputSchema: (0, zod_to_json_schema_1.zodToJsonSchema)(SearchRequestSchema),
                    },
                    {
                        name: 'getFullXml',
                        description: 'Retrieve the full XML content of a file',
                        inputSchema: (0, zod_to_json_schema_1.zodToJsonSchema)(GetFullXmlRequestSchema),
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
                // Check if search term is empty
                if (!searchTerm || searchTerm.trim() === '') {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    error: "Please provide a search term. You can use spaces to search for multiple terms."
                                }, null, 2),
                            },
                        ],
                    };
                }
                const results = yield (0, searchXml_1.performSearch)(this.indexedData, searchTerm);
                // Format the results to include helpful information
                const formattedResults = results.slice(0, limit).map(result => {
                    var _a;
                    return Object.assign(Object.assign({}, result), { filename: path_1.default.basename(result.file), directory: path_1.default.dirname(result.file), matchedTerms: (_a = result.matchedTerms) === null || _a === void 0 ? void 0 : _a.join(', '), relevanceScore: result.relevance });
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                query: searchTerm,
                                terms: searchTerm.split(' ').filter(t => t.length > 0),
                                totalResults: results.length,
                                displayedResults: formattedResults.length,
                                results: formattedResults
                            }, null, 2),
                        },
                    ],
                };
            }
            throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }));
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
