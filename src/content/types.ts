export interface PaginatorConfig {
    totalPages?: number;
    activePage?: number;
    onPageClick?: (page: number) => void;
    getPageTooltip?: (page: number) => { title: string; meta?: string } | null;
}

export type PaginationElement = number | 'dots';

export type Conversation = {
    id: string,
    conversationItems?: ConversationItem [],
    isFullyInitialized?: boolean
}

export type ConversationItem = {
    userMessage: Turn,
    assistantMessage?: Turn[], 
}

export type Turn = {
    id: string,
    turnNumber: number,
}

export type Config = {

}