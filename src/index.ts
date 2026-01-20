#!/usr/bin/env node

import { generate, DEFAULT_MAX_DEPTH } from './generator';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: endpoint-to-query <graphql-endpoint-url> [output-file] [--depth <number>]');
    process.exit(1);
  }

  let endpoint = '';
  let outputPath = '';
  let maxDepth = 0; // Default to 0 (Auto/Infinite)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--depth') {
      if (i + 1 < args.length) {
        const depthVal = parseInt(args[i + 1], 10);
        if (isNaN(depthVal) || depthVal < 0) {
             console.error('Error: --depth must be a non-negative integer (0 for auto)');
             process.exit(1);
        }
        maxDepth = depthVal;
        i++; // Skip next arg
      } else {
        console.error('Error: --depth requires a value');
        process.exit(1);
      }
    } else if (!endpoint) {
      endpoint = arg;
    } else if (!outputPath) {
      outputPath = arg;
    }
  }

  if (!endpoint) {
    console.error('Usage: endpoint-to-query <graphql-endpoint-url> [output-file] [--depth <number>]');
    console.error('Error: Endpoint URL is required');
    process.exit(1);
  }

  const finalOutputPath = outputPath ? path.resolve(outputPath) : path.join(process.cwd(), 'query.graphql');

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Output: ${finalOutputPath}`);
  console.log(`Max Depth: ${maxDepth === 0 ? 'Auto (Cycle Detection)' : maxDepth}`);

  try {
    await generate(endpoint, finalOutputPath, maxDepth);
  } catch (error: any) {
    if (error.message === 'OUTPUT_TOO_LARGE') {
        console.error('\n⚠️  Error: The generated query is too large to handle in memory (Node.js string limit).');
        console.error(`   This usually happens with massive schemas when using 'Auto' depth.`);
        console.error(`   Falling back to a safe depth of ${DEFAULT_MAX_DEPTH}...\n`);
        
        await generate(endpoint, finalOutputPath, DEFAULT_MAX_DEPTH);
        console.log(`\n✅ Success! Generated query using safe depth of ${DEFAULT_MAX_DEPTH}.`);
        console.log(`   If you need deeper queries, try running with '--depth 15' or similar.`);
    } else {
        throw error;
    }
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
