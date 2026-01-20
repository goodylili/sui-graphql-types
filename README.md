# schema-to-query

A simple yet powerful CLI tool that introspects a GraphQL endpoint and generates a ready-to-use `.graphql` file containing all available **Queries** and **Mutations**.

It automatically generates selection sets for objects, interfaces, and unions (up to a depth of 7 to avoid massive files), making it incredibly easy to explore a new API or bootstrap your client-side queries.

## Features

- **Zero Config**: Just provide the endpoint URL.
- **Complete Coverage**: Generates operations for every Query and Mutation field defined in the schema.
- **Smart Selection**: Recursively builds selection sets for Objects and Interfaces (safe depth of 7, avoiding cycles).
- **Union Support**: Automatically generates inline fragments for Union types.
- **Prettified**: Output is automatically formatted using Prettier.
- **Flexible Output**: Defaults to `query.graphql`, or specify your own output path.

## Usage

### Using `npx` (Recommended)

You don't need to install anything. Just run:

```bash
npx schema-to-query <graphql-endpoint-url> [output-file]
```

**Examples:**

Generate `query.graphql` in the current directory:
```bash
npx schema-to-query https://graphql.mainnet.sui.io/graphql
```

Generate to a specific file:
```bash
npx schema-to-query https://graphql.mainnet.sui.io/graphql ./sui-operations.graphql
```

### Global Installation

If you use it frequently, you can install it globally:

```bash
npm install -g schema-to-query
```

Then run it anywhere:

```bash
schema-to-query https://your-api.com/graphql
```

## Development

If you want to run it locally or contribute:

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```
4.  Run the CLI:
    ```bash
    node dist/index.js https://graphql.mainnet.sui.io/graphql
    ```

## License

MIT
