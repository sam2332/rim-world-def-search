import { indexXmlFiles } from "./utils/fileIndex";
import { performSearch } from "./utils/searchXml";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Enter search term (e.g., SimpleMeal or Meat):");
rl.on("line", async (input) => {
  const searchTerm = input.trim();
  if (!searchTerm) {
    console.log("Please enter a search term.");
    return;
  }
  // You may want to adjust the search path to your RimWorld Defs folder or test folder
  const searchPath = "c:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs";
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
  console.log("Enter search term (or Ctrl+C to exit):");
});
