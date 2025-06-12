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
import { XMLParser } from 'fast-xml-parser';

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
  // Extracts the full parent DOM tree containing the search term
  private extractFullParentTree(xml: string, searchTerm: string): string | null {
    const lowerXml = xml.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    let idx = lowerXml.indexOf(lowerTerm);
    if (idx === -1) return null;

    // Find all parent nodes leading up to the root
    const openTags: string[] = [];
    const closeTags: string[] = [];
    let pos = idx;

    while (pos >= 0) {
      const openTagMatch = lowerXml.lastIndexOf('<', pos);
      const closeTagMatch = lowerXml.indexOf('>', openTagMatch);

      if (openTagMatch !== -1 && closeTagMatch !== -1) {
        const tag = xml.substring(openTagMatch + 1, closeTagMatch).split(' ')[0];
        if (!tag.startsWith('/')) {
          openTags.push(tag);
        } else {
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
  private async performSearch(searchTerm: string): Promise<SearchResult[]> {
    const searchTerms = searchTerm.split(' ').filter(term => term.trim() !== '');
    const results: SearchResult[] = [];

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
  }

  // Helper to find nodes matching the search term
  private findNodes(tree: any, term: string): string[] {
    const nodes: string[] = [];

    const traverse = (node: any, parentKey: string = '') => {
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
  private getParentNode(tree: any, node: string): string {
    const traverse = (currentNode: any, parentNode: string): string => {
      if (typeof currentNode === 'object') {
        for (const key in currentNode) {
          if (key === node) {
            return parentNode;
          }
          const result = traverse(currentNode[key], key);
          if (result) return result;
        }
      }
      return '';
    };

    return traverse(tree, '');
  }

  // Initialize XML parser
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });

  // Build an in-RAM tree or minimal index of nodes
  private async buildXmlIndex(directory: string): Promise<Record<string, any>> {
    const index: Record<string, any> = {};

    const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];

    for (const file of files) {
      const filePath = path.join(directory, file);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        const subIndex = await this.buildXmlIndex(filePath);
        Object.assign(index, subIndex); // Merge subdirectory index
      } else if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && file.endsWith('.xml')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsedXml = this.parser.parse(content);
        index[filePath] = parsedXml; // Store parsed XML tree
      }
    }

    return index;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

  }
}

const server = new RimWorldDefSearchServer();
server.run().catch(console.error);
