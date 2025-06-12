import fs from 'fs';
import path from 'path';
import { SearchResult } from '../types';

export function indexXmlFiles(directories: string[]): SearchResult[] {
  const indexedData: SearchResult[] = [];

  const indexDirectory = (directory: string) => {
    const files = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
    for (const file of files) {
      const filePath = path.join(directory, file);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        indexDirectory(filePath);
      } else if (fs.existsSync(filePath) && fs.statSync(filePath).isFile() && file.endsWith('.xml')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        indexedData.push({ file: `${filePath}`, content, relevance: 0 });
      }
    }
  };

  for (const directory of directories) {
    indexDirectory(directory);
  }

  return indexedData;
}
