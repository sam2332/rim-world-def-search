import { SearchResult } from '../types';
import { parser, builder, formatXml } from './xmlHelpers';
import path from 'path';

export async function performSearch(indexedData: SearchResult[], searchTerm: string): Promise<SearchResult[]> {
  const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
  const results: SearchResult[] = [];
  const MAX_LEN = 1000;

  for (const data of indexedData) {
    // Check if file name matches any of the search terms
    const fileName = path.basename(data.file).toLowerCase();
    const filePathLower = data.file.toLowerCase();
    let fileNameRelevance = 0;
    
    // Calculate filename relevance
    searchTerms.forEach(term => {
      if (fileName.includes(term)) {
        fileNameRelevance += 2; // Higher relevance for filename match
      } else if (filePathLower.includes(term)) {
        fileNameRelevance += 1; // Lower relevance for path match
      }
    });

    // Check content for matches
    const jsonTree = parser.parse(data.content);
    const matchingNodes: {node: any, matchedTerms: string[]}[] = [];
    
    // Find all nodes that match any search term
    searchTerms.forEach(term => {
      const nodes = findMatchingNodes(jsonTree, term);
      nodes.forEach(node => {
        const existingMatch = matchingNodes.find(m => m.node === node);
        if (existingMatch) {
          existingMatch.matchedTerms.push(term);
        } else {
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
        const snippetXml = builder.build(matchingNodes[0].node);
        const formattedSnippetXml = formatXml(snippetXml);
        content = formattedSnippetXml;
        
        if (formattedSnippetXml.length > MAX_LEN) {
          content = formattedSnippetXml.slice(0, MAX_LEN) + '\n... [truncated, use Full Xml feature to see all]';
          truncated = true;
        }
      } else {
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
            ...(matchingNodes[0]?.matchedTerms || [])])] : 
          matchingNodes[0]?.matchedTerms || []
      });
    }  }
  
  // Sort results by relevance (highest first)
  results.sort((a, b) => b.relevance - a.relevance);
  return results;
}

function findMatchingNodes(obj: any, term: string): any[] {
  const matches: any[] = [];
  const recurse = (node: any, parent: any = null) => {
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
