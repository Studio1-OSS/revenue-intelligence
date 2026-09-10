export function processingMessage(
  processed: number,
  failures: number,
  remaining: number,
) {
  const message = `${processed} chunks processed. ${failures} failed.${remaining ? ` ${remaining} pending; run processing again to continue.` : ""}${failures ? " Check your AI provider and retry." : ""}`;
  if (failures) throw new Error(message);
  return message;
}
