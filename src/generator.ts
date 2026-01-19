
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

const MAX_DEPTH = 3;

function getUnwrappedType(type: GraphQLType): GraphQLType {
  if (isNonNullType(type)) {
    return getUnwrappedType(type.ofType);
  }
  if (isListType(type)) {
    return getUnwrappedType(type.ofType);
  }
  return type;
}

function generateFieldSelection(type: GraphQLType, depth: number = 0): string {
  if (depth > MAX_DEPTH) {
    return '';
  }

  const unwrappedType = getUnwrappedType(type);

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
        if (depth < MAX_DEPTH) {
            const subSelection = generateFieldSelection(field.type, depth + 1);
            if (subSelection) {
                return `${field.name} { ${subSelection} }`;
            }
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
          const subSelection = generateFieldSelection(t, depth + 1);
           if (subSelection) {
                return `... on ${t.name} { ${subSelection} }`;
            }
            return null;
      }).filter(Boolean).join('\n');
      return selection;
  }

  return '';
}

function generateOperation(operationType: 'query' | 'mutation', fieldName: string, field: GraphQLField<any, any>): string {
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

    const selection = generateFieldSelection(field.type, 1);
    
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

export async function generate(endpoint: string, outputPath: string) {
  try {
    const schema = await fetchSchema(endpoint);

    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();

    let output = '';

    if (queryType) {
      const fields = queryType.getFields();
      for (const [fieldName, field] of Object.entries(fields)) {
        output += generateOperation('query', fieldName, field) + '\n\n';
      }
    }

    if (mutationType) {
      const fields = mutationType.getFields();
      for (const [fieldName, field] of Object.entries(fields)) {
          output += generateOperation('mutation', fieldName, field) + '\n\n';
      }
    }

    console.log('Formatting output...');
    const formatted = await prettier.format(output, { parser: 'graphql' });
    
    fs.writeFileSync(outputPath, formatted);
    console.log(`Generated queries at ${outputPath}`);
  } catch (error) {
    console.error('Error generating queries:', error);
    process.exit(1);
  }
}
