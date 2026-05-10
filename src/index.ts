#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import matter from "gray-matter";

const MEMORY_DIR =
  process.env.CLAUDE_MEMORY_DIR ??
  join(process.env.HOME ?? process.env.USERPROFILE ?? ".", ".claude", "memory");

const INDEX_FILE = join(MEMORY_DIR, "MEMORY.md");

const VALID_TYPES = ["user", "feedback", "project", "reference"] as const;
type MemoryType = (typeof VALID_TYPES)[number];

interface MemoryFile {
  path: string;
  filename: string;
  name: string;
  description: string;
  type: MemoryType;
  body: string;
}

function ensureMemoryDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

function readMemoryFile(filename: string): MemoryFile | null {
  const path = join(MEMORY_DIR, filename);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf-8");
  const parsed = matter(raw);
  const data = parsed.data as Partial<MemoryFile>;
  if (!data.name || !data.description || !data.type) return null;
  if (!VALID_TYPES.includes(data.type as MemoryType)) return null;
  return {
    path,
    filename,
    name: data.name,
    description: data.description,
    type: data.type as MemoryType,
    body: parsed.content.trim(),
  };
}

function listMemoryFiles(): MemoryFile[] {
  ensureMemoryDir();
  return readdirSync(MEMORY_DIR)
    .filter((f) => f.endsWith(".md") && f !== "MEMORY.md")
    .map(readMemoryFile)
    .filter((m): m is MemoryFile => m !== null);
}

function rebuildIndex(): void {
  const memories = listMemoryFiles();
  const sorted = [...memories].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const lines = sorted.map(
    (m) => `- [${m.name}](${m.filename}) — ${m.description}`
  );
  writeFileSync(INDEX_FILE, lines.join("\n") + "\n", "utf-8");
}

function writeMemory(input: {
  filename: string;
  name: string;
  description: string;
  type: MemoryType;
  body: string;
}): void {
  ensureMemoryDir();
  const frontmatter = `---\nname: ${input.name}\ndescription: ${input.description}\ntype: ${input.type}\n---\n\n${input.body.trim()}\n`;
  writeFileSync(join(MEMORY_DIR, input.filename), frontmatter, "utf-8");
  rebuildIndex();
}

function searchMemory(query: string): MemoryFile[] {
  const q = query.toLowerCase();
  return listMemoryFiles().filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.body.toLowerCase().includes(q)
  );
}

function deleteMemory(filename: string): boolean {
  const path = join(MEMORY_DIR, filename);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  rebuildIndex();
  return true;
}

const server = new Server(
  { name: "claude-memory-mcp", version: "0.1.0" },
  { capabilities: { resources: {}, tools: {} } }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const memories = listMemoryFiles();
  return {
    resources: memories.map((m) => ({
      uri: `memory://${m.filename}`,
      name: m.name,
      description: `[${m.type}] ${m.description}`,
      mimeType: "text/markdown",
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri;
  const filename = uri.replace(/^memory:\/\//, "");
  const memory = readMemoryFile(filename);
  if (!memory) {
    throw new Error(`Memory not found: ${filename}`);
  }
  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text: readFileSync(memory.path, "utf-8"),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_memory",
      description: "List all memory files with their type and description",
      inputSchema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: VALID_TYPES,
            description: "Filter by memory type (optional)",
          },
        },
      },
    },
    {
      name: "search_memory",
      description: "Search memory by keyword (matches name, description, body)",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword" },
        },
        required: ["query"],
      },
    },
    {
      name: "add_memory",
      description: "Add a new memory file. Auto-rebuilds MEMORY.md index.",
      inputSchema: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Filename (e.g., user_role.md). Use snake_case + memory_type prefix.",
          },
          name: { type: "string", description: "Short title" },
          description: {
            type: "string",
            description: "One-line description (used in MEMORY.md index)",
          },
          type: { type: "string", enum: VALID_TYPES },
          body: { type: "string", description: "Memory body in markdown" },
        },
        required: ["filename", "name", "description", "type", "body"],
      },
    },
    {
      name: "update_memory",
      description: "Update an existing memory file. Auto-rebuilds MEMORY.md index.",
      inputSchema: {
        type: "object",
        properties: {
          filename: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: VALID_TYPES },
          body: { type: "string" },
        },
        required: ["filename", "name", "description", "type", "body"],
      },
    },
    {
      name: "delete_memory",
      description: "Delete a memory file. Auto-rebuilds MEMORY.md index.",
      inputSchema: {
        type: "object",
        properties: {
          filename: { type: "string" },
        },
        required: ["filename"],
      },
    },
    {
      name: "rebuild_index",
      description: "Rebuild MEMORY.md index from existing files",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  switch (name) {
    case "list_memory": {
      const filter = (args?.type as MemoryType | undefined) ?? null;
      const memories = listMemoryFiles().filter((m) => !filter || m.type === filter);
      const text = memories
        .map((m) => `- [${m.type}] ${m.filename}: ${m.name} — ${m.description}`)
        .join("\n");
      return {
        content: [{ type: "text", text: text || "(no memory files)" }],
      };
    }

    case "search_memory": {
      const query = args?.query as string;
      const memories = searchMemory(query);
      const text = memories
        .map((m) => `- ${m.filename}: ${m.name} — ${m.description}`)
        .join("\n");
      return {
        content: [{ type: "text", text: text || `(no matches for "${query}")` }],
      };
    }

    case "add_memory":
    case "update_memory": {
      writeMemory(args as Parameters<typeof writeMemory>[0]);
      return {
        content: [
          { type: "text", text: `Memory ${name === "add_memory" ? "added" : "updated"}: ${args?.filename}` },
        ],
      };
    }

    case "delete_memory": {
      const filename = args?.filename as string;
      const ok = deleteMemory(filename);
      return {
        content: [{ type: "text", text: ok ? `Deleted: ${filename}` : `Not found: ${filename}` }],
      };
    }

    case "rebuild_index": {
      rebuildIndex();
      return { content: [{ type: "text", text: "MEMORY.md rebuilt" }] };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`claude-memory-mcp started. MEMORY_DIR=${MEMORY_DIR}`);
