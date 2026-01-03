export async function waitForElement(selector: string, { root = document, timeoutMs = 90000 } = {}): Promise<Element> {
    return new Promise((resolve, reject) => {
        const find = () => root.querySelector(selector);

        const existing = find();
        if (existing) {
            return resolve(existing);
        }

        if (!root) {
            // Extremely early execution edge-case
            return reject(new Error("No valid observation target found."));
        }

        let timer: ReturnType<typeof setTimeout> | null = null;

        const observer = new MutationObserver(() => {
            const el = find();
            if (el) {
                observer.disconnect();
                if (timer) clearTimeout(timer);
                resolve(el);
            }
        });

        observer.observe(root, { childList: true, subtree: true });

        if (timeoutMs > 0) {
            timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`waitForElm timeout after ${timeoutMs}ms: ${selector}`));
            }, timeoutMs);
        }
    });
}