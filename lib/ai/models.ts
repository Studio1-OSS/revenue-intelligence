export const CHAT_MODEL_IDS = [
  "nvidia/Nemotron-3_5-Lightning",
  "nvidia/nemotron-3-super-120b-a12b",
] as const;
export type ChatModel = (typeof CHAT_MODEL_IDS)[number];
export const DEFAULT_CHAT_MODEL: ChatModel = CHAT_MODEL_IDS[0];
export const CHAT_MODELS = [
  {
    id: CHAT_MODEL_IDS[0],
    label: "Nemotron 3.5 Lightning",
    region: "Global endpoint",
  },
  {
    id: CHAT_MODEL_IDS[1],
    label: "Nemotron 3 Super 120B A12B",
    region: "US Central endpoint",
  },
] as const;
export const EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-8B";
export const DIMENSIONS = 1536;
export function isChatModel(model: string): model is ChatModel {
  return CHAT_MODEL_IDS.some((id) => id === model);
}
