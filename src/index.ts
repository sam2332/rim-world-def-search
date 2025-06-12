#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import * as fuzzy from 'fuzzy';
import net from 'net';
import { z } from 'zod';

interface SearchResult {
  file: string;
  content: string;
  relevance: number; // Added relevance property for ranking
}

// Define reusable schemas
const SearchRequestSchema = z.object({
  searchTerm: z.string(),
  limit: z.number().optional().default(5).refine((val) => val >= 1 && val <= 50, {
    message: 'Limit must be between 1 and 50',
  }),
});

const GetFullXmlRequestSchema = z.object({
  filePath: z.string(),
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

    this.indexFiles(); // Index files during startup
    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async indexFiles() {
    const directories = config.directories;

    const indexDirectory = (directory: string) => {
      const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];

      for (const file of files) {
        const filePath = path.join(directory, file);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          indexDirectory(filePath); // Recursive call for subdirectories
        } else if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && file.endsWith('.xml')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          this.indexedData.push({ file: `${filePath}`, content, relevance: 0 });
        }
      }
    };

    for (const directory of directories) {
      indexDirectory(directory);
    }

    console.log(`Indexed ${this.indexedData.length} files.`);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
      }

      if (request.params.name === 'search') {
        const parsedArgs = SearchRequestSchema.safeParse(request.params.arguments);

        if (!parsedArgs.success) {
          throw new McpError(ErrorCode.InvalidParams, parsedArgs.error.message);
        }

        const { searchTerm, limit } = parsedArgs.data;

        const results = await this.performSearch(searchTerm);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results.slice(0, limit), null, 2),
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
  private async performSearch(searchTerm: string): Promise<SearchResult[]> {
    const searchTerms = searchTerm.split(' ').filter(term => term.trim() !== '');

    const results = this.indexedData
      .map((data) => {
        const lines = data.content.split('\n');
        let totalRelevance = 0;
        let matchCount = 0;
        const relatedTags: string[] = [];

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
      .filter((result): result is SearchResult => result !== null);

    return results.sort((a, b) => b.relevance - a.relevance);
  }


  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

  }
}

const server = new RimWorldDefSearchServer();
server.run().catch(console.error);
