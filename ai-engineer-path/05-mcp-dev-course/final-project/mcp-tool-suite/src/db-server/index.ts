import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "db-query-server",
  version: "1.0.0",
});

server.tool(
  "query_database",
  "执行只读 SQL 查询（仅 SELECT）",
  { sql: z.string().describe("SQL SELECT 查询语句") },
  async ({ sql }) => {
    if (!sql.trim().toUpperCase().startsWith("SELECT")) {
      return { content: [{ type: "text", text: "错误: 仅允许 SELECT 查询" }] };
    }
    return {
      content: [{ type: "text", text: `[Mock] 执行查询: ${sql}\n结果: (模拟数据)` }],
    };
  }
);

server.resource(
  "db://tables",
  "db://tables",
  async (uri) => ({
    contents: [
      { uri: uri.href, text: "users, posts, comments, categories" },
    ],
  })
);

server.prompt(
  "sql-template",
  "生成 SQL 查询模板",
  { table: z.string(), columns: z.string().optional() },
  async ({ table, columns }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `SELECT ${columns || "*"} FROM ${table} LIMIT 10`,
        },
      },
    ],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
