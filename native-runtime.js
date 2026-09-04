(function configureLifeCycleNativeRuntime() {
    const capacitor = window.Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;

    const apiBaseUrl = 'https://lifecycle-ykn5.onrender.com';
    const nativeOrigin = window.location.origin;
    const originalFetch = window.fetch.bind(window);

    function resolveNativeApiTarget(input) {
        const rawUrl = typeof input === 'string'
            ? input
            : (input instanceof URL ? input.href : input?.url);
        if (!rawUrl) return null;
        try {
            const parsed = new URL(rawUrl, nativeOrigin);
            if (parsed.origin !== nativeOrigin || !parsed.pathname.startsWith('/api/')) return null;
            return `${apiBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch (_error) {
            return null;
        }
    }

    window.__LIFECYCLE_IS_NATIVE__ = true;
    window.__LIFECYCLE_API_BASE_URL__ = apiBaseUrl;
    window.fetch = function lifecycleNativeFetch(input, init) {
        const target = resolveNativeApiTarget(input);
        if (!target) return originalFetch(input, init);
        if (typeof Request !== 'undefined' && input instanceof Request) {
            return originalFetch(new Request(target, input), init);
        }
        return originalFetch(target, init);
    };
})();
