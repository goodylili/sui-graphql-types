#!/usr/bin/env node

import { generate } from './generator';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: schema-to-query <graphql-endpoint-url> [output-file]');
    process.exit(1);
  }

  const endpoint = args[0];
  const outputPath = args[1] ? path.resolve(args[1]) : path.join(process.cwd(), 'query.graphql');

  console.log(`Endpoint: ${endpoint}`);
  console.log(`Output: ${outputPath}`);

  await generate(endpoint, outputPath);
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
