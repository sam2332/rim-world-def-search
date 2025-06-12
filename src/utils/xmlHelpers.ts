import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
export const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function formatXml(xml: string): string {
  return xml
    .replace(/>(\s*)</g, '>$1<')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
