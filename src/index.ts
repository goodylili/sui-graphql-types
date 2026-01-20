#!/usr/bin/env node

import { generate } from './generator';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: endpoint-to-query <graphql-endpoint-url> [output-file] [--depth <number>]');
    process.exit(1);
  }

  let endpoint = '';
  let outputPath = '';
  let maxDepth = 7; // Default

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--depth') {
      if (i + 1 < args.length) {
        const depthVal = parseInt(args[i + 1], 10);
        if (isNaN(depthVal) || depthVal < 1) {
             console.error('Error: --depth must be a positive integer');
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
  console.log(`Max Depth: ${maxDepth}`);

  await generate(endpoint, finalOutputPath, maxDepth);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
