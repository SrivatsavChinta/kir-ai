export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function toolOk(confirmation: string, data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: `${confirmation}\n\n${JSON.stringify(data, null, 2)}` }],
    structuredContent: { confirmation, ...data },
  };
}

export function toolError(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
    structuredContent: { error: message },
  };
}
