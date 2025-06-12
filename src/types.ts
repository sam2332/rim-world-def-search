export interface SearchResult {
  file: string;
  content: string;
  relevance: number;
  truncated?: boolean; // true if content is truncated
  fullXmlAvailable?: boolean; // true if user can request full xml
}
