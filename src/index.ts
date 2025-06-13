#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { indexXmlFiles } from './utils/fileIndex';
import { performSearch } from './utils/searchXml';
import { SearchResult } from './types';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const SearchRequestSchema = z.object({
  searchTerm: z.string(),
  limit: z.number().optional().default(5).refine((val) => val >= 1 && val <= 50, {
    message: 'Limit must be between 1 and 50',
  }),
});

const GetFullXmlRequestSchema = z.object({
  filePath: z.string(),
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
  private server: Server;
  private indexedData: SearchResult[] = [];

  constructor() {
    this.server = new Server(
      {
        name: 'rimworld-def-search',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    this.indexedData = indexXmlFiles(config.directories);
    this.setupToolHandlers();
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search',
          description: 'Search RimWorld Def files for specific terms',
          inputSchema: zodToJsonSchema(SearchRequestSchema),
        },
        {
          name: 'getFullXml',
          description: 'Retrieve the full XML content of a file',
          inputSchema: zodToJsonSchema(GetFullXmlRequestSchema),
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'getFullXml') {
        const args = request.params.arguments as { filePath: string };
        const { filePath } = args;
        if (!fs.existsSync(filePath)) {
          throw new McpError(ErrorCode.InvalidParams, `File not found: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const result: SearchResult = { file: filePath, content, relevance: 0 };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }      if (request.params.name === 'search') {
        const parsedArgs = SearchRequestSchema.safeParse(request.params.arguments);
        if (!parsedArgs.success) {
          throw new McpError(ErrorCode.InvalidParams, parsedArgs.error.message);
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
        
        const results = await performSearch(this.indexedData, searchTerm);
        
        // Format the results to include helpful information
        const formattedResults = results.slice(0, limit).map(result => {
          return {
            ...result,
            filename: path.basename(result.file),
            directory: path.dirname(result.file),
            matchedTerms: result.matchedTerms?.join(', '),
            relevanceScore: result.relevance,
          };
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
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new RimWorldDefSearchServer();
server.run().catch(console.error);
