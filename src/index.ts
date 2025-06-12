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

interface SearchResult {
  file: string;
  content: string;
  relevance: number; // Added relevance property for ranking
}

const isValidSearchArgs = (args: any): args is { searchTerm: string; limit?: number } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.searchTerm === 'string' &&
  (args.limit === undefined || (typeof args.limit === 'number' && args.limit >= 1 && args.limit <= 50));
const isValidGetFullXmlArgs = (args: any): args is { filePath: string } =>
  typeof args === 'object' &&
  args !== null &&
  typeof args.filePath === 'string' &&
  fs.existsSync(args.filePath) && fs.statSync(args.filePath).isFile();
  
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
    const directories = [
      'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs',
      'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Royalty/Defs',
      'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Ideology/Defs',
      'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Biotech/Defs',
    ];

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
          inputSchema: {
            type: 'object',
            properties: {
              searchTerm: {
                type: 'string',
                description: 'Search term to look for in XML files',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                minimum: 1,
                maximum: 50,
              },
            },
            required: ['searchTerm'],
          },
        },
        {
          name: 'getFullXml',
          description: 'Retrieve the full XML content of a file',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to the XML file',
              },
            },
            required: ['filePath'],
          },
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

      if (request.params.name !== 'search') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (!isValidSearchArgs(request.params.arguments)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid search arguments'
        );
      }

      const { searchTerm, limit = 5 } = request.params.arguments;

      try {
        const results = await this.performSearch(searchTerm);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results.slice(0, limit), null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          return {
            content: [
              {
                type: 'text',
                text: `Search error: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
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

  private async findAvailablePort(startPort: number): Promise<number> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(startPort, () => {
        server.close(() => resolve(startPort));
      });
      server.on('error', () => {
        resolve(this.findAvailablePort(startPort + 1));
      });
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    const port = await this.findAvailablePort(3000);
    console.error(`RimWorld Def Search MCP server running on port ${port}`);
  }
}

const server = new RimWorldDefSearchServer();
server.run().catch(console.error);
