import { expect, test } from "bun:test";
import {
  assistantReducer,
  initialAssistantState,
  type EvidenceAnswer,
} from "../lib/assistant-state";
import { processingMessage } from "../lib/processing-result";

const answer: EvidenceAnswer = {
  answer: "Renewal is blocked. [1]",
  threadId: "thread-1",
  citations: [
    {
      id: "source-1",
      title: "Renewal call",
      domain: "example.com",
      quote: "Our renewal is blocked.",
    },
  ],
};

test("completed answers retain their submitted question independently from later drafts", () => {
  const state = assistantReducer(initialAssistantState, {
    type: "answer",
    query: "Why is renewal blocked?",
    result: answer,
  });
  expect(state.answeredQuery).toBe("Why is renewal blocked?");
  expect(state.threadId).toBe("thread-1");
  expect(state.answer).toEqual(answer);
});
test("a follow-up clears old output while preserving the conversation for retry", () => {
  const completed = assistantReducer(initialAssistantState, {
    type: "answer",
    query: "First question",
    result: answer,
  });
  const loading = assistantReducer(completed, { type: "start", mode: "ask" });
  expect(loading.answer).toBeNull();
  expect(loading.answeredQuery).toBe("");
  expect(loading.threadId).toBe("thread-1");
  expect(loading.busy).toBe(true);
  const failed = assistantReducer(loading, {
    type: "error",
    message: "Provider unavailable",
  });
  expect(failed.busy).toBe(false);
  expect(failed.answer).toBeNull();
  expect(failed.error).toBe("Provider unavailable");
});
test("empty search is distinct from not-yet-searched and stale results disappear on retry", () => {
  const empty = assistantReducer(initialAssistantState, {
    type: "search",
    query: "Missing topic",
    hits: [],
  });
  expect(empty.searchedQuery).toBe("Missing topic");
  const previous = assistantReducer(initialAssistantState, {
    type: "search",
    query: "Renewal",
    hits: [
      {
        id: "source-1",
        title: "Call",
        domain: "example.com",
        body: "Renewal",
        score: 1,
      },
    ],
  });
  const loading = assistantReducer(previous, { type: "start", mode: "search" });
  expect(loading.hits).toEqual([]);
  expect(loading.searchedQuery).toBeNull();
  const failed = assistantReducer(loading, {
    type: "error",
    message: "Search failed",
  });
  expect(failed.hits).toEqual([]);
  expect(failed.error).toBe("Search failed");
});
test("new conversations clear output, search, errors, and the previous thread", () => {
  const state = assistantReducer(initialAssistantState, {
    type: "answer",
    query: "Question",
    result: answer,
  });
  expect(assistantReducer(state, { type: "reset" })).toEqual(
    initialAssistantState,
  );
});
test("a saved-query error does not unlock an in-flight AI request", () => {
  const state = assistantReducer(initialAssistantState, {
    type: "start",
    mode: "ask",
  });
  expect(
    assistantReducer(state, { type: "notice", message: "Sharing failed" }).busy,
  ).toBe(true);
});
test("partial processing failures cannot be presented as success", () => {
  expect(() => processingMessage(2, 1, 4)).toThrow(
    "2 chunks processed. 1 failed. 4 pending",
  );
  expect(processingMessage(3, 0, 2)).toContain("2 pending");
  expect(processingMessage(3, 0, 0)).toBe("3 chunks processed. 0 failed.");
});
