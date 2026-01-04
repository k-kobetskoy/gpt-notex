import { ConversationItem, Turn } from "../content/types";

type Role = "user" | "assistant" | "unknown";

export function getRole(article: Element): Role {
  const role = article.getAttribute("data-turn");
  if (role === "user" || role === "assistant")
    return role;

  //fallback
  const alternativeRole = article.querySelector("[data-message-author-role]")?.getAttribute("data-message-author-role");
  if (alternativeRole === "user" || alternativeRole === "assistant")
    return alternativeRole;

  return "unknown";
}

function parseTurnNumber(article: Element): number {
  const testId = article.getAttribute("data-testid") ?? "";
  const m = testId.match(/conversation-turn-(\d+)/);

  return Number(m ? [1] : -1);
}

export function parseTurn(article: Element): Turn {
  const id =
    article.getAttribute("data-turn-id") || article.querySelector("[data-message-id]")?.getAttribute("data-message-id") || "";

  return {
    id,
    turnNumber: parseTurnNumber(article),
  };
}

export function buildConversationItems(articles: Element[]): { observableItems: Map<Element, Turn>, conversationItems: ConversationItem[] } {

  const conversationItems: ConversationItem[] = [];
  const observableItems: Map<Element, Turn> = new Map;
  let current: ConversationItem | null = null;

  for (const article of articles) {
    const role = getRole(article);
    const turn = parseTurn(article);

    if (!observableItems.has(article)) {
      current = { userMessage: turn };
      observableItems.set(article, turn);
    }

    if (!turn.id) continue;

    if (role === "user") {
      current = { userMessage: turn };
      conversationItems.push(current);
      continue;
    }

    if (role === "assistant") {
      if (!current) {
        continue;
      }
      current.assistantMessage ??= [];
      current.assistantMessage.push(turn);
    }
  }

  return {observableItems: observableItems, conversationItems: conversationItems};
}

function tryGetConversationIdFromUrl(href: string): string | null {
  const m = href.match(/\/c\/([a-zA-Z0-9-]+)(?:\/|$)/);
  return m?.[1] ?? null;
}

export function waitForConversationUrl(timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const tick = () => {
      const id = tryGetConversationIdFromUrl(location.href);
      if (id) {
        resolve(id);
        return;
      }

      if (Date.now() - started > timeoutMs) {
        reject(new Error("Conversation URL did not appear in time"));
        return;
      }

      setTimeout(tick, 50);
    };

    tick();
  });
}

