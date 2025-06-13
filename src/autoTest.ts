import { indexXmlFiles } from "./utils/fileIndex";
import { performSearch } from "./utils/searchXml";
import path from "path";

// Test different search terms
const searchTests = [
  "SimpleMeal",                  // Single term
  "Skill Required",              // Multiple terms
  "Tea Psychite",                // Search terms that should match Psychite_Tea.xml
  "Psych Drug",                  // Terms that match different aspects (filename and content)
];

// Set your RimWorld Defs path here
const searchPath = "c:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs";

(async () => {
  try {
    console.log("Indexing files...");
    const indexedData = indexXmlFiles([searchPath]);
    console.log(`Indexed ${indexedData.length} files`);
    
    for (const searchTerm of searchTests) {
      console.log(`\n\n========= TESTING SEARCH: "${searchTerm}" =========`);
      const results = await performSearch(indexedData, searchTerm);
      
      if (results.length === 0) {
        console.log("No results found.");
      } else {
        console.log(`Found ${results.length} results. Showing top 3:`);
        results.slice(0, 3).forEach((result, index) => {
          console.log(`\n--- RESULT #${index + 1} ---`);
          console.log(`File: ${result.file}`);
          console.log(`Filename: ${path.basename(result.file)}`);
          console.log(`Relevance: ${result.relevance}`);
          console.log(`Matched Terms: ${result.matchedTerms?.join(', ') || 'none'}`);
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
  } catch (err) {
    console.error("Error during search:", err);
  }
})();
