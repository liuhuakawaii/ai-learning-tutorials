import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "api-adapter-server",
  version: "1.0.0",
});

server.tool(
  "http_request",
  "发送 HTTP 请求到外部 API",
  {
    method: z.enum(["GET", "POST", "PUT", "DELETE"]),
    url: z.string().url(),
    body: z.string().optional(),
  },
  async ({ method, url, body }) => {
    return {
      content: [
        {
          type: "text",
          text: `[Mock] ${method} ${url}\n${body ? `Body: ${body}` : ""}\nResponse: {"status": 200, "data": {}}`,
        },
      ],
    };
  }
);

server.resource(
  "api://docs",
  "api://docs",
  async (uri) => ({
    contents: [
      { uri: uri.href, text: "可用 API 端点文档 (Mock)" },
    ],
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
