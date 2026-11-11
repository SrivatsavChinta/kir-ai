import { handleMcpRequest } from "@/lib/mcp/handler";

export const maxDuration = 60;

async function handle(request: Request) {
  return handleMcpRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE, handle as OPTIONS };
