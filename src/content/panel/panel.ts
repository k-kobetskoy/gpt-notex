import html from './panel.html?raw';
import css from './panel.css?raw';
import { ensureFontsLoaded } from '../ui';
import dotsSvg from '../../../public/icons/dots.svg?raw';

export interface PaginatorConfig {
    totalPages?: number;
    activePage?: number;
    onPageClick?: (page: number) => void;
    getPageTooltip?: (page: number) => { title: string; meta?: string } | null;
}

export type PaginationElement = number | 'dots';

export async function mountPaginator(host: HTMLElement, config: PaginatorConfig = {}) {
    const root = host.shadowRoot;
    if (!root) throw new Error('Host element must have a shadow root');

    await ensureFontsLoaded();

    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);

    root.innerHTML += html;

    const pagesContainer = root.getElementById('pages')!;
    const navUp = root.getElementById('nav-up') as HTMLButtonElement;
    const navDown = root.getElementById('nav-down') as HTMLButtonElement;
    const tooltip = root.getElementById('tooltip')!;

    let totalPages = config.totalPages ?? 15;
    let activePage = config.activePage ?? 0;
    let viewPage = activePage;
    const MAX_VISIBLE = 10;

    const state = {
        pageElements: [] as HTMLElement[],
        indicators: new Set<number>(),
    };

    function clampPage(page: number) {
        return Math.min(Math.max(page, 0), Math.max(0, totalPages - 1));
    }

    function setViewPage(page: number) {
        const clamped = clampPage(page);
        if (clamped === viewPage) return;
        viewPage = clamped;
    }

    navUp.disabled = activePage === 0;
    navDown.disabled = activePage === totalPages - 1;

    let wheelAccumulator = 0;
    const WHEEL_STEP_PX = 48;
    const paginatorEl = root.querySelector('.paginator') as HTMLElement | null;
    (paginatorEl ?? pagesContainer).addEventListener(
        'wheel',
        (e) => {
            e.preventDefault();
            e.stopPropagation();

            wheelAccumulator += e.deltaY;
            while (wheelAccumulator >= WHEEL_STEP_PX) {
                wheelAccumulator -= WHEEL_STEP_PX;
                setViewPage(viewPage + 1);
                render();
            }
            while (wheelAccumulator <= -WHEEL_STEP_PX) {
                wheelAccumulator += WHEEL_STEP_PX;
                setViewPage(viewPage - 1);
                render();
            }
        },
        { passive: false },
    );

    function createPageElement(pageNum: number): HTMLElement {
        const el = document.createElement('div');
        el.className = 'page-item';
        el.textContent = String(pageNum + 1);
        el.dataset.page = String(pageNum);

        el.addEventListener('click', () => {
            setActivePage(pageNum);
            viewPage = activePage;
            config.onPageClick?.(pageNum);
        });

        el.addEventListener('mouseenter', (e) => showTooltip(e, pageNum));
        el.addEventListener('mouseleave', hideTooltip);

        return el;
    }


    function createDots(): HTMLElement {
        const dots = document.createElement('div');
        dots.className = 'page-dots';
        dots.innerHTML = dotsSvg;
        return dots;
    }

    function render() {
        pagesContainer.innerHTML = '';
        state.pageElements = [];

        if (totalPages === 0) return;

        const paginationElements: PaginationElement[] = [];

        if (totalPages <= MAX_VISIBLE) {
            for (let i = 0; i < totalPages; i++) paginationElements.push(i);
        } else {
            const halfOfVisiblePages = Math.round((MAX_VISIBLE - 2) / 2);

            const showFirst = viewPage <= halfOfVisiblePages;
            const showLast = viewPage >= totalPages - halfOfVisiblePages;
            const showMiddle = !showFirst && !showLast;

            if (showFirst) {
                for (let i = 0; i < MAX_VISIBLE - 2; i++) paginationElements.push(i);
                paginationElements.push('dots');
                paginationElements.push(totalPages - 1);
            } else if (showLast) {
                paginationElements.push(0);
                paginationElements.push('dots');
                for (let i = totalPages - MAX_VISIBLE + 2; i < totalPages; i++) paginationElements.push(i);
            } else if (showMiddle) {
                const halfOfVisiblePages = Math.round((MAX_VISIBLE - 4) / 2);
                const loverPageNumber = activePage - halfOfVisiblePages;
                const highPageNumber = activePage + halfOfVisiblePages;
                paginationElements.push(0);
                paginationElements.push('dots');
                for (let i = loverPageNumber; i < highPageNumber; i++) paginationElements.push(i);
                paginationElements.push('dots');
                paginationElements.push(totalPages - 1);
            }
        }

        paginationElements.forEach((item) => {
            if (item === 'dots') {
                pagesContainer.appendChild(createDots());
            } else {
                const el = createPageElement(item);
                if (item === activePage) el.classList.add('active');
                if (state.indicators.has(item)) el.classList.add('has-indicator');
                state.pageElements.push(el);
                pagesContainer.appendChild(el);
            }
        });

        navUp.disabled = activePage === 0;
        navDown.disabled = activePage === totalPages - 1;

        console.log(`active page: ${activePage} view page: ${viewPage}`);
    }

    function setActivePage(page: number) {
        if (page < 0 || page >= totalPages) return;
        activePage = page;
        viewPage = activePage;
        render();
    }

    function showTooltip(e: MouseEvent, page: number) {
        const tooltipData = config.getPageTooltip?.(page);
        if (!tooltipData) return;

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();

        tooltip.innerHTML = tooltipData.meta
            ? `<div class="tooltip-title">${tooltipData.title}</div><div class="tooltip-meta">${tooltipData.meta}</div>`
            : tooltipData.title;

        tooltip.classList.add('visible');

        const tooltipRect = tooltip.getBoundingClientRect();
        const left = rect.left - tooltipRect.width - 12;
        const top = rect.top + rect.height / 2 - tooltipRect.height / 2;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
    }

    navUp.addEventListener('click', () => {
        if (activePage > 0) {
            setActivePage(activePage - 1);
            config.onPageClick?.(activePage);
        }
        // setViewPage(viewPage - 1);
    });

    navDown.addEventListener('click', () => {
        if (activePage < totalPages - 1) {
            setActivePage(activePage + 1);
            config.onPageClick?.(activePage);
        }
        // viewPage = activePage;
        // setViewPage(viewPage + 1);
    });

    render();

    return {
        setTotalPages(count: number) {
            totalPages = count;
            if (activePage >= totalPages) activePage = Math.max(0, totalPages - 1);
            render();
        },
        setActivePage,
        addIndicator(page: number) {
            state.indicators.add(page);
            render();
        },
        removeIndicator(page: number) {
            state.indicators.delete(page);
            render();
        },
        getActivePage: () => activePage,
    };
}
