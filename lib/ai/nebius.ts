import "server-only";
import { z } from "zod";
import { AppError } from "../errors";
import {
  EMBEDDING_MODEL,
  DIMENSIONS,
  isChatModel,
  type ChatModel,
} from "./models";
export { EMBEDDING_MODEL, DIMENSIONS } from "./models";
const endpoint = "https://api.tokenfactory.nebius.com/v1/";
const chatEndpoints: Record<ChatModel, string> = {
  "Qwen/Qwen3.8-27B": endpoint,
  "nvidia/Nemotron-3_5-Lightning": endpoint,
  "nvidia/nemotron-3-super-120b-a12b":
    "https://api.tokenfactory.us-central1.nebius.com/v1/",
};
const usage = z
  .object({ total_tokens: z.number().int().nonnegative().optional() })
  .optional();
type UserContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" } }
    >;
export class Nebius {
  public readonly model: ChatModel;
  constructor(
    private key: string,
    model: string,
    private transport: typeof fetch = fetch,
  ) {
    if (!key)
      throw new AppError(
        "AI_KEY_REQUIRED",
        "Add and verify a Nebius key before using AI.",
        402,
      );
    if (!isChatModel(model))
      throw new AppError(
        "AI_MODEL_REQUIRED",
        "Select and verify a supported model in AI settings.",
        409,
      );
    this.model = model;
  }
  private async request(path: string, body: unknown, baseUrl = endpoint) {
    let response: Response;
    try {
      response = await this.transport(baseUrl + path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });
    } catch {
      throw new AppError(
        "AI_UNAVAILABLE",
        "Nebius is unavailable. Try again shortly.",
        502,
      );
    }
    if (!response.ok) {
      const code =
        response.status === 401 || response.status === 403
          ? "AI_KEY_INVALID"
          : response.status === 429
            ? "AI_RATE_LIMITED"
            : response.status === 402
              ? "AI_CREDIT_REQUIRED"
              : "AI_PROVIDER_ERROR";
      throw new AppError(
        code,
        code === "AI_KEY_INVALID"
          ? "Nebius rejected this key. Reconnect your AI provider."
          : code === "AI_CREDIT_REQUIRED"
            ? "Add credit to your Nebius account."
            : code === "AI_RATE_LIMITED"
              ? "Nebius rate limit reached. Try again later."
              : "Nebius could not complete this request. Check your selected model and account.",
        response.status === 429 ? 429 : 502,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new AppError(
        "AI_INVALID_RESPONSE",
        "Nebius returned an invalid response.",
        502,
      );
    }
  }
  async embed(texts: string[]) {
    const parsed = z
      .object({
        data: z.array(
          z.object({
            index: z.number().int(),
            embedding: z.array(z.number().finite()).length(DIMENSIONS),
          }),
        ),
        usage,
      })
      .safeParse(
        await this.request("embeddings", {
          model: EMBEDDING_MODEL,
          dimensions: DIMENSIONS,
          input: texts,
          encoding_format: "float",
        }),
      );
    if (!parsed.success || parsed.data.data.length !== texts.length)
      throw new AppError(
        "AI_INVALID_EMBEDDING",
        "Nebius returned incompatible embeddings.",
        502,
      );
    const ordered = parsed.data.data.sort((a, b) => a.index - b.index);
    if (ordered.some((e, i) => e.index !== i))
      throw new AppError(
        "AI_INVALID_EMBEDDING",
        "Nebius returned invalid embedding indices.",
        502,
      );
    return {
      vectors: ordered.map((e) => e.embedding),
      tokens: parsed.data.usage?.total_tokens || 0,
    };
  }
  private chatBody(
    system: string,
    input: UserContent,
    jsonMode: boolean,
    maxTokens: number,
  ) {
    return {
      model: this.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
      // Reserve the bounded output budget for the answer, not reasoning.
      ...(this.model === "Qwen/Qwen3.8-27B"
        ? { chat_template_kwargs: { enable_thinking: false } }
        : {}),
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    };
  }
  private async chat(
    system: string,
    input: UserContent,
    jsonMode: boolean,
    maxTokens: number,
  ) {
    const result = z
      .object({
        choices: z
          .array(
            z.object({
              message: z.object({ content: z.string().trim().min(1) }),
            }),
          )
          .min(1),
        usage,
      })
      .safeParse(
        await this.request(
          "chat/completions",
          this.chatBody(system, input, jsonMode, maxTokens),
          chatEndpoints[this.model],
        ),
      );
    if (!result.success)
      throw new AppError(
        "AI_INVALID_RESPONSE",
        "Nebius returned an invalid response.",
        502,
      );
    return {
      text: result.data.choices[0].message.content,
      tokens: result.data.usage?.total_tokens || 0,
    };
  }
  async complete(
    system: string,
    input: string,
    jsonMode = true,
    maxTokens = 1600,
  ) {
    return this.chat(system, input, jsonMode, maxTokens);
  }
  async completeImage(
    system: string,
    input: string,
    image: { dataUrl: string; detail?: "low" | "high" },
    jsonMode = true,
    maxTokens = 2200,
  ) {
    if (this.model !== "Qwen/Qwen3.8-27B")
      throw new AppError(
        "AI_MODEL_REQUIRED",
        "Visual evidence extraction requires Qwen3.8 27B in AI settings.",
        409,
      );
    return this.chat(
      system,
      [
        { type: "text", text: input },
        {
          type: "image_url",
          image_url: { url: image.dataUrl, detail: image.detail || "high" },
        },
      ],
      jsonMode,
      maxTokens,
    );
  }
}
