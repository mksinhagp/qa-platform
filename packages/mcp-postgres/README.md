# QA Platform PostgreSQL MCP Server

Custom MCP server providing full read/write access to PostgreSQL database for the QA Platform project.

## Features

- **query**: Execute read-only SELECT queries
- **execute**: Execute write operations (INSERT, UPDATE, DELETE, DDL)
- **transaction**: Execute multiple SQL statements in a transaction

## Installation

Dependencies are installed via the workspace pnpm setup:

```bash
cd packages/mcp-postgres
pnpm install
```

## Building

```bash
pnpm build
```

## Configuration

The server uses the following environment variables (in order of precedence):

- `DATABASE_URL`: Full PostgreSQL connection string
- `POSTGRES_URL`: Alternative PostgreSQL connection string
- Default: `postgresql://qa_user:qa_password@localhost:5432/qa_platform`

## MCP Configuration

To use this MCP server, add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "qa_platform_pg": {
      "command": "node",
      "args": [
        "/Users/mksmoshome/Library/CloudStorage/OneDrive-Personal/Projects/WebsiteTester/packages/mcp-postgres/dist/index.js"
      ],
      "env": {
        "DATABASE_URL": "postgresql://qa_user:qa_password@localhost:5432/qa_platform"
      }
    }
  }
}
```

## Tools

### query

Execute a read-only SELECT query.

**Parameters:**
- `sql` (string): The SQL SELECT query to execute

**Example:**
```json
{
  "sql": "SELECT * FROM sites LIMIT 10"
}
```

### execute

Execute a write operation (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, etc.).

**Parameters:**
- `sql` (string): The SQL statement to execute

**Example:**
```json
{
  "sql": "INSERT INTO sites (name, url) VALUES ('Test Site', 'https://example.com')"
}
```

### transaction

Execute multiple SQL statements in a transaction.

**Parameters:**
- `statements` (array of strings): Array of SQL statements to execute in a transaction

**Example:**
```json
{
  "statements": [
    "INSERT INTO sites (name, url) VALUES ('Site 1', 'https://example1.com')",
    "INSERT INTO sites (name, url) VALUES ('Site 2', 'https://example2.com')"
  ]
}
```

## Development

To run in development mode with TypeScript watch:

```bash
pnpm dev
```

To run the built server directly:

```bash
pnpm start
```

## Database Access

This server provides full database access. Use with caution:

- The `execute` tool can modify data and schema
- The `transaction` tool can execute multiple changes atomically
- Always validate SQL before execution in production
