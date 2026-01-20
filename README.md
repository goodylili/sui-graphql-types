# endpoint-to-query

A simple yet powerful CLI tool that introspects a GraphQL endpoint and generates a ready-to-use `.graphql` file containing all available **Queries** and **Mutations**.

It automatically generates selection sets for objects, interfaces, and unions (up to a depth of 7 to avoid massive files), making it incredibly easy to explore a new API or bootstrap your client-side queries.

## Features

- **Zero Config**: Just provide the endpoint URL.
- **Complete Coverage**: Generates operations for every Query and Mutation field defined in the schema.
- **Smart Selection**: Recursively builds selection sets. By default, it traverses as deep as possible until cycles are detected ("Auto" mode).
- **Safety Fallback**: If "Auto" mode produces a file too large for memory, it automatically retries with a safe depth of 3.
- **Union Support**: Automatically generates inline fragments for Union types.
- **Prettified**: Output is automatically formatted using Prettier.
- **Flexible Output**: Defaults to `query.graphql`, or specify your own output path.

## Usage

### Using `npx` (Recommended)

You don't need to install anything. Just run:

```bash
npx endpoint-to-query <graphql-endpoint-url> [output-file] [--depth <number>]
```

**Examples:**

Generate `query.graphql` in the current directory (default depth 7):
```bash
npx endpoint-to-query https://graphql.mainnet.sui.io/graphql
```

Generate with a custom depth of 10:
```bash
npx endpoint-to-query https://graphql.mainnet.sui.io/graphql --depth 10
```

Generate to a specific file:
```bash
npx endpoint-to-query https://graphql.mainnet.sui.io/graphql ./sui-operations.graphql
```

### Global Installation

If you use it frequently, you can install it globally:

```bash
npm install -g endpoint-to-query
```

Then run it anywhere:

```bash
endpoint-to-query https://your-api.com/graphql
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
