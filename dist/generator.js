"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate = generate;
const fs = __importStar(require("fs"));
const graphql_1 = require("graphql");
const prettier = __importStar(require("prettier"));
const MAX_DEPTH = 3;
function getUnwrappedType(type) {
    if ((0, graphql_1.isNonNullType)(type)) {
        return getUnwrappedType(type.ofType);
    }
    if ((0, graphql_1.isListType)(type)) {
        return getUnwrappedType(type.ofType);
    }
    return type;
}
function generateFieldSelection(type, depth = 0) {
    if (depth > MAX_DEPTH) {
        return '';
    }
    const unwrappedType = getUnwrappedType(type);
    if ((0, graphql_1.isScalarType)(unwrappedType)) {
        return '';
    }
    if ((0, graphql_1.isObjectType)(unwrappedType) || (0, graphql_1.isInterfaceType)(unwrappedType)) {
        const fields = unwrappedType.getFields();
        const selection = Object.values(fields)
            .map((field) => {
            const fieldType = getUnwrappedType(field.type);
            if ((0, graphql_1.isScalarType)(fieldType)) {
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
    if ((0, graphql_1.isUnionType)(unwrappedType)) {
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
function generateOperation(operationType, fieldName, field) {
    const args = field.args;
    let queryName = `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
    if (operationType === 'mutation')
        queryName = 'Mutate' + queryName;
    else
        queryName = 'Get' + queryName;
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
async function fetchSchema(endpoint) {
    console.log(`Fetching schema from ${endpoint}...`);
    const introspectionQuery = (0, graphql_1.getIntrospectionQuery)();
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
    return (0, graphql_1.buildClientSchema)(introspectionData);
}
async function generate(endpoint, outputPath) {
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
    }
    catch (error) {
        console.error('Error generating queries:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=generator.js.map