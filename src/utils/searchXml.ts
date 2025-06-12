import { SearchResult } from '../types';
import { parser, builder, formatXml } from './xmlHelpers';

export async function performSearch(indexedData: SearchResult[], searchTerm: string): Promise<SearchResult[]> {
  const lowerTerm = searchTerm.toLowerCase();
  const results: SearchResult[] = [];
  const MAX_LEN = 1000;

  for (const data of indexedData) {
    const jsonTree = parser.parse(data.content);
    const nodes = findMatchingNodes(jsonTree, lowerTerm);
    if (nodes.length) {
      const snippetXml = builder.build(nodes[0]);
      const formattedSnippetXml = formatXml(snippetXml);
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
}

function findMatchingNodes(obj: any, term: string): any[] {
  const matches: any[] = [];
  const recurse = (node: any, parent: any = null) => {
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
