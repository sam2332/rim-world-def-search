import { indexXmlFiles } from "./utils/fileIndex";
import { performSearch } from "./utils/searchXml";

// Set your search term here
const searchTerm = "SimpleMeal";
// Set your RimWorld Defs path here
const searchPath = "c:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs";

(async () => {
  try {
    const indexedData = indexXmlFiles([searchPath]);
    const results = await performSearch(indexedData, searchTerm);
    if (results.length === 0) {
      console.log("No results found.");
    } else {
      results.forEach((result) => {
        console.log(`File: ${result.file}`);
        console.log(result.content);
        if (result.truncated) {
          console.log("[Result truncated. Use Full Xml feature to see all.]");
        }
        console.log("---");
      });
    }
  } catch (err) {
    console.error("Error during search:", err);
  }
})();
