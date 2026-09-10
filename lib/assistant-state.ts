import type { SearchHit } from "./types";

export type EvidenceAnswer = {
  answer: string;
  citations: { id: string; title: string; domain: string; quote: string }[];
  threadId: string | null;
};
export type AssistantState = {
  answer: EvidenceAnswer | null;
  answeredQuery: string;
  threadId: string | null;
  hits: SearchHit[];
  searchedQuery: string | null;
  busy: boolean;
  error: string;
};
export const initialAssistantState: AssistantState = {
  answer: null,
  answeredQuery: "",
  threadId: null,
  hits: [],
  searchedQuery: null,
  busy: false,
  error: "",
};
export type AssistantAction =
  | { type: "start"; mode: string }
  | { type: "answer"; query: string; result: EvidenceAnswer }
  | { type: "search"; query: string; hits: SearchHit[] }
  | { type: "error"; message: string }
  | { type: "notice"; message: string }
  | { type: "reset" };

export function assistantReducer(
  state: AssistantState,
  action: AssistantAction,
): AssistantState {
  switch (action.type) {
    case "start":
      return {
        ...state,
        busy: true,
        error: "",
        ...(action.mode === "ask"
          ? { answer: null, answeredQuery: "" }
          : { hits: [], searchedQuery: null }),
      };
    case "answer":
      return {
        ...state,
        busy: false,
        error: "",
        answer: action.result,
        answeredQuery: action.query,
        threadId: action.result.threadId,
      };
    case "search":
      return {
        ...state,
        busy: false,
        error: "",
        hits: action.hits,
        searchedQuery: action.query,
      };
    case "error":
      return { ...state, busy: false, error: action.message };
    case "notice":
      return { ...state, error: action.message };
    case "reset":
      return initialAssistantState;
  }
}
