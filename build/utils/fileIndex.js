"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexXmlFiles = indexXmlFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function indexXmlFiles(directories) {
    const indexedData = [];
    const indexDirectory = (directory) => {
        const files = fs_1.default.existsSync(directory) ? fs_1.default.readdirSync(directory) : [];
        for (const file of files) {
            const filePath = path_1.default.join(directory, file);
            if (fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isDirectory()) {
                indexDirectory(filePath);
            }
            else if (fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isFile() && file.endsWith('.xml')) {
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                indexedData.push({ file: `${filePath}`, content, relevance: 0 });
            }
        }
    };
    for (const directory of directories) {
        indexDirectory(directory);
    }
    return indexedData;
}
