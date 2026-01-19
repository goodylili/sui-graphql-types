
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
} from 'graphql';
import type {
  IntrospectionQuery,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLField,
  GraphQLType,
  GraphQLArgument,
} from 'graphql';
import * as prettier from 'prettier';

const schemaPath = path.join(__dirname, '../sui_mainnet_schema.json');
const schemaJson = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Handle both raw introspection result and { data: ... } wrapper
const introspectionData = schemaJson.data ? schemaJson.data : schemaJson;
const schema: GraphQLSchema = buildClientSchema(introspectionData as IntrospectionQuery);

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
        // Skip deprecated fields if you want clean output
        // if (field.deprecationReason) return null;
        
        const fieldType = getUnwrappedType(field.type);
        if (isScalarType(fieldType)) {
            return field.name;
        }
        // Only recurse for objects if we have depth left
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
      // For unions, we need inline fragments
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

    // Handle Arguments
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

async function main() {
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

  const formatted = await prettier.format(output, { parser: 'graphql' });
  fs.writeFileSync(path.join(__dirname, '../all_operations.graphql'), formatted);
  console.log('Generated all_operations.graphql');
}

main().catch(console.error);
