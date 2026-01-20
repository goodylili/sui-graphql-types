
import * as fs from 'fs';
import * as path from 'path';
import {
  buildClientSchema,
  isScalarType,
  isObjectType,
  isListType,
  isNonNullType,
  isInterfaceType,
  isUnionType,
  getIntrospectionQuery,
} from 'graphql';
import type {
  IntrospectionQuery,
  GraphQLSchema,
  GraphQLField,
  GraphQLType,
} from 'graphql';
import * as prettier from 'prettier';

// A safe maximum depth to prevent OOM/StackOverflow on large schemas.
// 7 is generally deep enough for almost all use cases while being safer than "infinite".
export const DEFAULT_MAX_DEPTH = 7;

function getUnwrappedType(type: GraphQLType): GraphQLType {
  if (isNonNullType(type)) {
    return getUnwrappedType(type.ofType);
  }
  if (isListType(type)) {
    return getUnwrappedType(type.ofType);
  }
  return type;
}

function generateFieldSelection(type: GraphQLType, maxDepth: number, visitedTypes: Set<string> = new Set(), depth: number = 0): string {
  if (depth > maxDepth) {
      return '';
  }

  const unwrappedType = getUnwrappedType(type);
  const typeName = 'name' in unwrappedType ? (unwrappedType as any).name : '';

  if (typeName && visitedTypes.has(typeName)) {
      return '';
  }

  const newVisitedTypes = new Set(visitedTypes);
  if (typeName) {
      newVisitedTypes.add(typeName);
  }

  if (isScalarType(unwrappedType)) {
    return '';
  }

  if (isObjectType(unwrappedType) || isInterfaceType(unwrappedType)) {
    const fields = unwrappedType.getFields();
    const selection = Object.values(fields)
      .map((field) => {
        const fieldType = getUnwrappedType(field.type);
        if (isScalarType(fieldType)) {
            return field.name;
        }
        
        const subSelection = generateFieldSelection(field.type, maxDepth, newVisitedTypes, depth + 1);
        if (subSelection) {
            return `${field.name} { ${subSelection} }`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n');
    
    return selection;
  }

  if (isUnionType(unwrappedType)) {
      const types = unwrappedType.getTypes();
      const selection = types.map(t => {
          const subSelection = generateFieldSelection(t, maxDepth, newVisitedTypes, depth + 1);
           if (subSelection) {
                return `... on ${t.name} { ${subSelection} }`;
            }
            return null;
      }).filter(Boolean).join('\n');
      return selection;
  }

  return '';
}

function generateOperation(operationType: 'query' | 'mutation', fieldName: string, field: GraphQLField<any, any>, maxDepth: number): string {
    const args = field.args;
    let queryName = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
    if (operationType === 'mutation') queryName = 'Mutate' + queryName;
    else queryName = 'Get' + queryName;

    let varDefs = '';
    let argsUsage = '';
    
    if (args.length > 0) {
        const vars = args.map(arg => {
             const typeStr = arg.type.toString();
             return `$${arg.name}: ${typeStr}`;
        });
        varDefs = `(${vars.join(', ')})`;
        
        const usages = args.map(arg => {
            return `${arg.name}: $${arg.name}`;
        });
        argsUsage = `(${usages.join(', ')})`;
    }

    const selection = generateFieldSelection(field.type, maxDepth);
    
    let op = `${operationType} ${queryName}${varDefs} {
        ${fieldName}${argsUsage} ${selection ? `{
            ${selection}
        }` : ''}
    }`;

    return op;
}

async function fetchSchema(endpoint: string): Promise<GraphQLSchema> {
    console.log(`Fetching schema from ${endpoint}...`);
    
    const introspectionQuery = getIntrospectionQuery();

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: introspectionQuery }),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(`Schema introspection errors: ${JSON.stringify(result.errors)}`);
    }

    const introspectionData = result.data;
    return buildClientSchema(introspectionData as IntrospectionQuery);
}

export async function generate(endpoint: string, outputPath: string, maxDepth: number = DEFAULT_MAX_DEPTH) {
    // If maxDepth is 0, we treat it as "Infinity" (relying on cycle detection).
    // However, to prevent stack overflows, we still need a theoretical limit.
    // 100 is deep enough to cover any realistic non-cyclic schema structure.
    const effectiveMaxDepth = maxDepth === 0 ? 100 : maxDepth;

    try {
    const schema = await fetchSchema(endpoint);

    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();

    let output = '';

    if (queryType) {
      const fields = queryType.getFields();
      for (const [fieldName, field] of Object.entries(fields)) {
        output += generateOperation('query', fieldName, field, effectiveMaxDepth) + '\n\n';
      }
    }

    if (mutationType) {
      const fields = mutationType.getFields();
      for (const [fieldName, field] of Object.entries(fields)) {
          output += generateOperation('mutation', fieldName, field, effectiveMaxDepth) + '\n\n';
      }
    }

    console.log('Formatting output...');
    // If the file is massive, Prettier might crash. We can try/catch this too.
    try {
        const formatted = await prettier.format(output, { parser: 'graphql' });
        fs.writeFileSync(outputPath, formatted);
    } catch (prettierError) {
        console.warn('Warning: Output too large for Prettier. Writing raw output...');
        fs.writeFileSync(outputPath, output);
    }
    
    console.log(`Generated queries at ${outputPath}`);
  } catch (error: any) {
    // Re-throw specific errors for the caller to handle
    if (error instanceof RangeError || error.message?.includes('Invalid string length')) {
        throw new Error('OUTPUT_TOO_LARGE');
    }
    throw error;
  }
}
