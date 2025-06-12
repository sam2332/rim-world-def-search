"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.builder = exports.parser = void 0;
exports.formatXml = formatXml;
const fast_xml_parser_1 = require("fast-xml-parser");
exports.parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
exports.builder = new fast_xml_parser_1.XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_' });
function formatXml(xml) {
    return xml
        .replace(/>(\s*)</g, '>$1<')
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();
}
