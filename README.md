# RimWorld Def Search

A powerful search tool to find RimWorld definition files in both Core game files and mods.

## Features

- **Multi-term Search**: Use spaces to separate multiple search terms. The tool will search for all terms and rank results by relevance.
- **Smart Search**: Searches both filenames and file contents.
- **Relevance-based Results**: Results are sorted by relevance, with matches in both filename and content given higher priority.
- **Minimal Examples**: Returns minimal examples of matching XML nodes for quick reference.

## Usage

### Search

```
search "Tea Psychite"
```

This will search for files containing both "Tea" and "Psychite" in either the filename or content.

### Get Full XML

```
getFullXml <filepath>
```

Returns the complete XML content of the specified file.

## Configuration

You can configure search paths in the config section of `index.ts`:

```typescript
const config = {
  directories: [
    process.env.RIMWORLD_CORE || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Core/Defs',
    process.env.RIMWORLD_ROYALTY || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Royalty/Defs',
    process.env.RIMWORLD_IDEOLOGY || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Ideology/Defs',
    process.env.RIMWORLD_BIOTECH || 'C:/Program Files (x86)/Steam/steamapps/common/RimWorld/Data/Biotech/Defs',
  ],
};
```

You can also set these directories via environment variables.

## How It Works

1. The tool indexes all XML files in the specified directories
2. When you search:
   - It splits your search term by spaces into individual terms
   - It searches both filenames and content for each term
   - It ranks results by how many terms match and where they match (filename matches get higher relevance)
   - It returns a minimal snippet of matching XML nodes
