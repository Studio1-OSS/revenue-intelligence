import "server-only";
import { z } from "zod";
import { auth0 } from "./auth0";
import { resolveWorkspace } from "./db";
import { AppError } from "./errors";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !expected || origin !== new URL(expected).origin)
    throw new AppError("INVALID_ORIGIN", "Request origin is not allowed.", 403);
}
export async function context(request: Request, mutation = false) {
  if (mutation) sameOrigin(request);
  const session = await auth0()?.getSession();
  if (!session)
    throw new AppError("UNAUTHORIZED", "Sign in to use your workspace.", 401);
  return resolveWorkspace(session.user, request.headers.get("x-workspace-id"));
}
export async function readBody(request: Request, max = 2_000_000) {
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new AppError("TOO_LARGE", "The upload is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("INVALID_BODY", "A request body is required.");
  let length = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw new AppError("TOO_LARGE", "The upload is too large.", 413);
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString("utf8");
}
export async function jsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
  max = 16_000,
): Promise<z.infer<T>> {
  let input: unknown;
  try {
    input = JSON.parse(await readBody(request, max));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INVALID_JSON", "Enter valid JSON.");
  }
  return schema.parse(input);
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return json({ error: error.code, message: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json(
      {
        error: "INVALID_INPUT",
        message: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
          .slice(0, 500),
      },
      400,
    );
  // Never return provider response bodies, request headers, or SQL parameters.
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    {
      error: "INTERNAL_ERROR",
      message: "The request could not be completed. Please try again.",
    },
    500,
  );
}
export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return failure(error);
    }
  };
}
