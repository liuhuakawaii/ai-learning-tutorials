import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const server = new McpServer({
  name: "filesystem-server",
  version: "1.0.0",
});

const ALLOWED_DIR = path.resolve(__dirname, "../../data");

server.tool(
  "read_file",
  "读取指定文件内容",
  { path: z.string().describe("文件路径（相对于 data 目录）") },
  async ({ path: filePath }) => {
    try {
      const fullPath = path.join(ALLOWED_DIR, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      return { content: [{ type: "text", text: content }] };
    } catch (e) {
      return { content: [{ type: "text", text: `错误: ${e}` }] };
    }
  }
);

server.tool(
  "write_file",
  "写入文件内容",
  {
    path: z.string().describe("文件路径（相对于 data 目录）"),
    content: z.string().describe("文件内容"),
  },
  async ({ path: filePath, content }) => {
    try {
      const fullPath = path.join(ALLOWED_DIR, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
      return { content: [{ type: "text", text: `已写入: ${filePath}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `错误: ${e}` }] };
    }
  }
);

server.resource(
  "fs://list",
  "fs://list",
  async (uri) => {
    try {
      const files = await fs.readdir(ALLOWED_DIR);
      return { contents: [{ uri: uri.href, text: files.join("\n") }] };
    } catch {
      return { contents: [{ uri: uri.href, text: "(空)" }] };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
