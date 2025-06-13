"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fileIndex_1 = require("./utils/fileIndex");
const searchXml_1 = require("./utils/searchXml");
const path_1 = __importDefault(require("path"));
// Test different search terms
const searchTests = [
    "SimpleMeal", // Single term
    "Skill Required", // Multiple terms
    "Tea Psychite", // Search terms that should match Psychite_Tea.xml
    "Psych Drug", // Terms that match different aspects (filename and content)
];
// Set your RimWorld Defs path here
const searchPath = "c:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs";
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Indexing files...");
        const indexedData = (0, fileIndex_1.indexXmlFiles)([searchPath]);
        console.log(`Indexed ${indexedData.length} files`);
        for (const searchTerm of searchTests) {
            console.log(`\n\n========= TESTING SEARCH: "${searchTerm}" =========`);
            const results = yield (0, searchXml_1.performSearch)(indexedData, searchTerm);
            if (results.length === 0) {
                console.log("No results found.");
            }
            else {
                console.log(`Found ${results.length} results. Showing top 3:`);
                results.slice(0, 3).forEach((result, index) => {
                    var _a;
                    console.log(`\n--- RESULT #${index + 1} ---`);
                    console.log(`File: ${result.file}`);
                    console.log(`Filename: ${path_1.default.basename(result.file)}`);
                    console.log(`Relevance: ${result.relevance}`);
                    console.log(`Matched Terms: ${((_a = result.matchedTerms) === null || _a === void 0 ? void 0 : _a.join(', ')) || 'none'}`);
                    console.log("\nContent Preview:");
                    console.log(result.content);
                    if (result.truncated) {
                        console.log("[Result truncated. Use Full Xml feature to see all.]");
                    }
                });
                if (results.length > 3) {
                    console.log(`\n... and ${results.length - 3} more results`);
                }
            }
        }
    }
    catch (err) {
        console.error("Error during search:", err);
    }
}))();
