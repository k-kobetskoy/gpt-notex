import html from './panel.html?raw';
import css from './panel.css?raw';
import { ensureFontsLoaded } from '@/src/content';
import dotsSvg from '@/public/icons/dots.svg?raw';
import { PaginatorConfig, PaginationElement, ConversationItem, Turn, Conversation } from '@/src/content/types';
import { buildConversationItems, delay, waitForElement } from '@/src/utils';
import { getRole, parseTurn, waitForConversationUrl } from '@/src/utils/conversation-parser';

export class Paginator {

    private readonly ARTICLE_SELECTOR = "article[data-turn-id]";
    private readonly MAIN_SELECTOR = "main";
    private readonly MAX_VISIBLE = 10;
    private readonly WHEEL_STEP_PX = 48;

    activeArticleId?: string;

    private chat?: Conversation;

    // private conversationItems: ConversationItem[] = [];

    private root: ShadowRoot;
    private config: PaginatorConfig;
    private pagesContainer: HTMLElement;
    private navUp: HTMLButtonElement;
    private navDown: HTMLButtonElement;
    private tooltip: HTMLElement;
    private totalPages: number;
    private activePage: number;
    private viewPage: number;
    private state: {
        pageElements: HTMLElement[];
        indicators: Set<number>;
    };

    private wheelAccumulator = 0;

    private constructor(root: ShadowRoot, config: PaginatorConfig) {
        this.root = root;
        this.config = config;
        this.totalPages = config.totalPages ?? 15;
        this.activePage = config.activePage ?? 0;
        this.viewPage = this.activePage;
        this.state = {
            pageElements: [],
            indicators: new Set<number>(),
        };

        this.pagesContainer = root.getElementById('pages')!;
        this.navUp = root.getElementById('nav-up') as HTMLButtonElement;
        this.navDown = root.getElementById('nav-down') as HTMLButtonElement;
        this.tooltip = root.getElementById('tooltip')!;

        this.setupEventListeners();
    }

    static async mount(host: HTMLElement, config: PaginatorConfig = {}): Promise<Paginator> {
        const root = host.shadowRoot;
        if (!root) throw new Error('Host element must have a shadow root');

        await ensureFontsLoaded();

        const style = document.createElement('style');
        style.textContent = css;
        root.appendChild(style);

        root.innerHTML += html;

        const paginator = new Paginator(root, config);
        const firstFoundArticle = await waitForElement(paginator.ARTICLE_SELECTOR);

        const articlesContainer = firstFoundArticle?.parentElement;

        if (articlesContainer) {
            paginator.initializeExistingChat(articlesContainer as Element);
        }

        paginator.initializeNewChat();

        paginator.createArticlesObserver(articlesContainer as Element);
        paginator.createActiveArticleObserver(articlesContainer as Element);
        paginator.render();

        return paginator;
    }

    private setupEventListeners(): void {
        this.navUp.disabled = this.activePage === 0;
        this.navDown.disabled = this.activePage === this.totalPages - 1;

        const paginatorEl = this.root.querySelector('.paginator') as HTMLElement | null;
        (paginatorEl ?? this.pagesContainer).addEventListener(
            'wheel',
            (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.wheelAccumulator += e.deltaY;
                while (this.wheelAccumulator >= this.WHEEL_STEP_PX) {
                    this.wheelAccumulator -= this.WHEEL_STEP_PX;
                    this.setViewPage(this.viewPage + 1);
                    this.render();
                }
                while (this.wheelAccumulator <= -this.WHEEL_STEP_PX) {
                    this.wheelAccumulator += this.WHEEL_STEP_PX;
                    this.setViewPage(this.viewPage - 1);
                    this.render();
                }
            },
            { passive: false },
        );

        this.navUp.addEventListener('click', () => {
            if (this.activePage > 0) {
                this.setActivePage(this.activePage - 1);
                this.config.onPageClick?.(this.activePage);
            }
        });

        this.navDown.addEventListener('click', () => {
            if (this.activePage < this.totalPages - 1) {
                this.setActivePage(this.activePage + 1);
                this.config.onPageClick?.(this.activePage);
            }
        });
    }

    initializeExistingChat(articlesContainer: Element, conversationId?: string) {
        const domArticleElements = Array.from(articlesContainer.querySelectorAll(this.ARTICLE_SELECTOR));

        this.createArticlesObserver(articlesContainer as Element);
        this.createActiveArticleObserver(articlesContainer as Element);

        const conversationItems = buildConversationItems(domArticleElements);

        const isFullyInitialized = !!conversationId || conversationItems[0].userMessage.turnNumber == 1;

        this.chat = {
            id: conversationId || window.location.href.split('/').at(-1)!,
            conversationItems: conversationItems,            
            isFullyInitialized: isFullyInitialized
        }
    }

    initializeNewChat() {
        const mainElement = document.querySelector(this.MAIN_SELECTOR) as HTMLElement;

        const onArticleAdd = (article: Element) => {
            const conversationId = await waitForConversationUrl();

            const articleContainer = article.parentElement;
            this.initializeExistingChat(articleContainer as Element, conversationId);

            mutationObserver.disconnect();
        }

        const mutationObserver = new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(n => {
                    if (n.nodeType != 1)
                        continue;

                    const el = n as Element;

                    if (el.matches?.(this.ARTICLE_SELECTOR)) {
                        onArticleAdd(el);
                        return;
                    }

                    const article = el.querySelector?.(this.ARTICLE_SELECTOR);
                    if (article) {
                        onArticleAdd(article);
                        return;
                    }
                });
            }
        });

        mutationObserver.observe(mainElement, { childList: true, subtree: true });
    }

    createArticlesObserver(articlesContainer: Element) {
        const onArticleAdd = (article: Element): void => {
            const turn = parseTurn(article);
            const role = getRole(article);
            const conversationItems = this.chat?.conversationItems!;

            if (role === 'user') {
                conversationItems.push({ userMessage: turn })
            } else if (role === 'assistant') {
                const lastElement = conversationItems.at(-1);

                if (lastElement) {
                    const assistantMessages = lastElement.assistantMessage || [];
                    assistantMessages.push(turn)
                }
            }
        }

        const onArticleRemove = (article: Element): void => {
            const turn = parseTurn(article);
            const role = getRole(article);

            const conversationItems = this.chat?.conversationItems;

            if (!conversationItems || conversationItems?.length <= 0) {
                return;
            }

            const conversationItemIndex = conversationItems.findIndex(item => {
                if (role === 'user')
                    return item.userMessage.id === turn.id
                else {
                    if (item.assistantMessage && item.assistantMessage.length > 0) {
                        return item.assistantMessage.find(mes => mes.id === turn.id)
                    }
                    return;
                }
            })

            if (conversationItemIndex < 0) {
                return;
            }

            conversationItems.splice(conversationItemIndex, 1);
        }

        const mutationObserver = new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(n => {
                    if (n.nodeType === 1) {
                        if ((n as Element).matches?.(this.ARTICLE_SELECTOR)) onArticleAdd(n as Element);
                        (n as Element).querySelectorAll?.(this.ARTICLE_SELECTOR).forEach(onArticleAdd);
                    }
                });
                m.removedNodes.forEach(n => {
                    if (n.nodeType === 1) {
                        if ((n as Element).matches?.(this.ARTICLE_SELECTOR)) onArticleRemove(n as HTMLElement);
                        (n as Element).querySelectorAll?.(this.ARTICLE_SELECTOR).forEach(onArticleRemove);
                    }
                });
            }
            this.render();
        });

        mutationObserver.observe(articlesContainer, { childList: true, subtree: true });
    }

    private createActiveArticleObserver(articlesContainer: Element) {
        const getId = (el: HTMLElement): string?=> (el.getAttribute("data-turn-id") ?? el.id);


        const observer = new IntersectionObserver(
            (articleContainer) => {

                const crossed = entries.filter(e => e.isIntersecting);
                if (crossed.length === 0) return;

                crossed.sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top);

                this.activeArticleId = getId(crossed[0].target as HTMLElement);
            },
            {
                articlesContainer,
                threshold: 1,
                rootMargin: "-75% 0px -25% 0px",
            }
        );

        for (const a of articles) observer.observe(a);

        getActiveArticleId(): ArticleId | null {
            if (activeId) return activeId;
            if (articles.length === 0) return null;

            return getId(articles[articles.length - 1]);
        }
    }

    private clampPage(page: number): number {
        return Math.min(Math.max(page, 0), Math.max(0, this.totalPages - 1));
    }

    private setViewPage(page: number): void {
        const clamped = this.clampPage(page);
        if (clamped === this.viewPage) return;
        this.viewPage = clamped;
    }

    private createPageElement(pageNum: number): HTMLElement {
        const el = document.createElement('div');
        el.className = 'page-item';
        el.textContent = String(pageNum + 1);
        el.dataset.page = String(pageNum);

        el.addEventListener('click', () => {
            this.setActivePage(pageNum);
            this.viewPage = this.activePage;
            this.config.onPageClick?.(pageNum);
        });

        el.addEventListener('mouseenter', (e) => this.showTooltip(e, pageNum));
        el.addEventListener('mouseleave', () => this.hideTooltip());

        return el;
    }

    private createDots(): HTMLElement {
        const dots = document.createElement('div');
        dots.className = 'page-dots';
        dots.innerHTML = dotsSvg;
        return dots;
    }

    private render(): void {
        this.pagesContainer.innerHTML = '';
        this.state.pageElements = [];

        if (this.totalPages === 0) return;

        const paginationElements: PaginationElement[] = [];

        if (this.totalPages <= this.MAX_VISIBLE) {
            for (let i = 0; i < this.totalPages; i++) paginationElements.push(i);
        } else {
            const halfOfVisiblePages = Math.round((this.MAX_VISIBLE - 2) / 2);

            const showFirst = this.viewPage <= halfOfVisiblePages;
            const showLast = this.viewPage >= this.totalPages - halfOfVisiblePages;
            const showMiddle = !showFirst && !showLast;

            if (showFirst) {
                for (let i = 0; i < this.MAX_VISIBLE - 2; i++) paginationElements.push(i);
                paginationElements.push('dots');
                paginationElements.push(this.totalPages - 1);
            } else if (showLast) {
                paginationElements.push(0);
                paginationElements.push('dots');
                for (let i = this.totalPages - this.MAX_VISIBLE + 2; i < this.totalPages; i++) paginationElements.push(i);
            } else if (showMiddle) {
                const halfOfVisiblePages = Math.round((this.MAX_VISIBLE - 4) / 2);
                const loverPageNumber = this.activePage - halfOfVisiblePages;
                const highPageNumber = this.activePage + halfOfVisiblePages;
                paginationElements.push(0);
                paginationElements.push('dots');
                for (let i = loverPageNumber; i < highPageNumber; i++) paginationElements.push(i);
                paginationElements.push('dots');
                paginationElements.push(this.totalPages - 1);
            }
        }

        paginationElements.forEach((item) => {
            if (item === 'dots') {
                this.pagesContainer.appendChild(this.createDots());
            } else {
                const el = this.createPageElement(item);
                if (item === this.activePage) el.classList.add('active');
                if (this.state.indicators.has(item)) el.classList.add('has-indicator');
                this.state.pageElements.push(el);
                this.pagesContainer.appendChild(el);
            }
        });

        this.navUp.disabled = this.activePage === 0;
        this.navDown.disabled = this.activePage === this.totalPages - 1;

        console.log(`active page: ${this.activePage} view page: ${this.viewPage}`);
    }

    private showTooltip(e: MouseEvent, page: number): void {
        const tooltipData = this.config.getPageTooltip?.(page);
        if (!tooltipData) return;

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();

        this.tooltip.innerHTML = tooltipData.meta
            ? `<div class="tooltip-title">${tooltipData.title}</div><div class="tooltip-meta">${tooltipData.meta}</div>`
            : tooltipData.title;

        this.tooltip.classList.add('visible');

        const tooltipRect = this.tooltip.getBoundingClientRect();
        const left = rect.left - tooltipRect.width - 12;
        const top = rect.top + rect.height / 2 - tooltipRect.height / 2;

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    private hideTooltip(): void {
        this.tooltip.classList.remove('visible');
    }

    public setTotalPages(count: number): void {
        this.totalPages = count;
        if (this.activePage >= this.totalPages) this.activePage = Math.max(0, this.totalPages - 1);
        this.render();
    }

    public setActivePage(page: number): void {
        if (page < 0 || page >= this.totalPages) return;
        this.activePage = page;
        this.viewPage = this.activePage;
        this.render();
    }

    public addIndicator(page: number): void {
        this.state.indicators.add(page);
        this.render();
    }

    public removeIndicator(page: number): void {
        this.state.indicators.delete(page);
        this.render();
    }

    public getActivePage(): number {
        return this.activePage;
    }
}