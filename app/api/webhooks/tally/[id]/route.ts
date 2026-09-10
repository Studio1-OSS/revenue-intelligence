import { z } from "zod";
import { failure, json, readBody } from "@/lib/http";
import { receiveTally } from "@/lib/integrations/tally";

export const runtime = "nodejs";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const id = z
      .string()
      .uuid()
      .parse((await ctx.params).id);
    const result = await receiveTally(
      id,
      await readBody(request, 100_000),
      request.headers.get("Tally-Signature"),
    );
    return json(result, "duplicate" in result ? 200 : 202);
  } catch (error) {
    return failure(error);
  }
}
