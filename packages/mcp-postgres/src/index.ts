#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Pool, PoolConfig } from 'pg';

// Get connection string from environment or use default
const connectionString = process.env.DATABASE_URL || 
  process.env.POSTGRES_URL ||
  'postgresql://qa_user:qa_password@localhost:5432/qa_platform';

// Create PostgreSQL connection pool
const poolConfig: PoolConfig = {
  connectionString,
};

const pool = new Pool(poolConfig);

// Create MCP server
const server = new Server(
  {
    name: 'qa-platform-postgres',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'query',
        description: 'Execute a read-only SELECT query on PostgreSQL',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'The SQL SELECT query to execute',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'execute',
        description: 'Execute a write operation (INSERT, UPDATE, DELETE, DDL) on PostgreSQL',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'The SQL statement to execute (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, etc.)',
            },
          },
          required: ['sql'],
        },
      },
      {
        name: 'transaction',
        description: 'Execute multiple SQL statements in a transaction',
        inputSchema: {
          type: 'object',
          properties: {
            statements: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of SQL statements to execute in a transaction',
            },
          },
          required: ['statements'],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'query') {
      const { sql } = args as { sql: string };
      
      // Validate that it's a SELECT query
      const trimmedSql = sql.trim().toUpperCase();
      if (!trimmedSql.startsWith('SELECT') && !trimmedSql.startsWith('WITH')) {
        throw new Error('query tool only accepts SELECT or WITH (CTE) queries');
      }

      const result = await pool.query(sql);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              rows: result.rows,
              rowCount: result.rowCount,
              fields: result.fields.map(f => f.name),
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'execute') {
      const { sql } = args as { sql: string };
      
      const result = await pool.query(sql);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              rowCount: result.rowCount,
              command: result.command,
              fields: result.fields.map(f => f.name),
            }, null, 2),
          },
        ],
      };
    }

    if (name === 'transaction') {
      const { statements } = args as { statements: string[] };
      
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        const results = [];
        for (const statement of statements) {
          const result = await client.query(statement);
          results.push({
            statement: statement.substring(0, 100) + (statement.length > 100 ? '...' : ''),
            rowCount: result.rowCount,
            command: result.command,
          });
        }
        
        await client.query('COMMIT');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                results,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Test connection
  try {
    await pool.query('SELECT 1');
    console.error('Connected to PostgreSQL successfully');
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
