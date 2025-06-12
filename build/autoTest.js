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
Object.defineProperty(exports, "__esModule", { value: true });
const fileIndex_1 = require("./utils/fileIndex");
const searchXml_1 = require("./utils/searchXml");
// Set your search term here
const searchTerm = "SimpleMeal";
// Set your RimWorld Defs path here
const searchPath = "c:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs";
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const indexedData = (0, fileIndex_1.indexXmlFiles)([searchPath]);
        const results = yield (0, searchXml_1.performSearch)(indexedData, searchTerm);
        if (results.length === 0) {
            console.log("No results found.");
        }
        else {
            results.forEach((result) => {
                console.log(`File: ${result.file}`);
                console.log(result.content);
                if (result.truncated) {
                    console.log("[Result truncated. Use Full Xml feature to see all.]");
                }
                console.log("---");
            });
        }
    }
    catch (err) {
        console.error("Error during search:", err);
    }
}))();
