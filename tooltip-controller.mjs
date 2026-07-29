const TOOLTIP_TARGET_SELECTOR = [
    '[data-tooltip]',
    '[title]',
    'button[aria-label]',
    'a[aria-label]',
    '[role="button"][aria-label]'
].join(',');

function normalizeText(value) {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim()
        : '';
}

export function getTooltipText(control) {
    if (!control) return '';

    const explicit = normalizeText(control.dataset?.tooltip);
    if (explicit) return explicit;

    const nativeTitle = normalizeText(control.getAttribute?.('title'));
    if (nativeTitle) return nativeTitle;

    const accessibleName = normalizeText(control.getAttribute?.('aria-label'));
    const visibleText = normalizeText(control.textContent);
    return accessibleName && !visibleText ? accessibleName : '';
}

export class TooltipController {
    constructor(root = document, {
        hoverDelay = 360,
        focusDelay = 80
    } = {}) {
        this.root = root;
        this.hoverDelay = hoverDelay;
        this.focusDelay = focusDelay;
        this.currentTarget = null;
        this.pendingTarget = null;
        this.showTimer = null;
        this.tooltip = null;

        this.handlePointerOver = this.handlePointerOver.bind(this);
        this.handlePointerOut = this.handlePointerOut.bind(this);
        this.handleFocusIn = this.handleFocusIn.bind(this);
        this.handleFocusOut = this.handleFocusOut.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.hide = this.hide.bind(this);
    }

    init() {
        if (!this.root?.addEventListener || this.tooltip) return;

        this.tooltip = document.createElement('div');
        this.tooltip.id = 'lifecycle-tooltip';
        this.tooltip.className = 'lifecycle-tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.setAttribute('aria-hidden', 'true');
        document.body.appendChild(this.tooltip);

        this.root.addEventListener('mouseover', this.handlePointerOver);
        this.root.addEventListener('mouseout', this.handlePointerOut);
        this.root.addEventListener('focusin', this.handleFocusIn);
        this.root.addEventListener('focusout', this.handleFocusOut);
        this.root.addEventListener('pointerdown', this.hide, true);
        this.root.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('scroll', this.hide, true);
        window.addEventListener('resize', this.hide);
    }

    destroy() {
        if (!this.tooltip) return;

        this.hide();
        this.root.removeEventListener('mouseover', this.handlePointerOver);
        this.root.removeEventListener('mouseout', this.handlePointerOut);
        this.root.removeEventListener('focusin', this.handleFocusIn);
        this.root.removeEventListener('focusout', this.handleFocusOut);
        this.root.removeEventListener('pointerdown', this.hide, true);
        this.root.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('scroll', this.hide, true);
        window.removeEventListener('resize', this.hide);
        this.tooltip.remove();
        this.tooltip = null;
    }

    findTarget(node) {
        if (!(node instanceof Element)) return null;
        const control = node.closest(TOOLTIP_TARGET_SELECTOR);
        if (
            !control
            || control.matches(':disabled, [aria-disabled="true"]')
            || !getTooltipText(control)
        ) {
            return null;
        }
        return control;
    }

    handlePointerOver(event) {
        const supportsHover = typeof window.matchMedia !== 'function'
            || window.matchMedia('(hover: hover)').matches;
        if (
            event.pointerType === 'touch'
            || event.sourceCapabilities?.firesTouchEvents
            || !supportsHover
        ) {
            return;
        }
        const target = this.findTarget(event.target);
        if (!target || target.contains(event.relatedTarget)) return;
        this.schedule(target, this.hoverDelay);
    }

    handlePointerOut(event) {
        const target = this.findTarget(event.target);
        if (!target || target.contains(event.relatedTarget)) return;
        if (target === this.currentTarget || target === this.pendingTarget) {
            this.hide();
        }
    }

    handleFocusIn(event) {
        const target = this.findTarget(event.target);
        if (target) this.schedule(target, this.focusDelay);
    }

    handleFocusOut(event) {
        if (
            this.currentTarget === event.target
            || this.pendingTarget === event.target
        ) {
            this.hide();
        }
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') this.hide();
    }

    schedule(target, delay) {
        clearTimeout(this.showTimer);
        if (this.currentTarget === target || this.pendingTarget === target) return;
        this.pendingTarget = target;
        this.showTimer = setTimeout(() => {
            this.show(target);
        }, delay);
    }

    show(target) {
        if (!this.tooltip || !target?.isConnected) return;

        const text = getTooltipText(target);
        if (!text) return;

        const nativeTitle = normalizeText(target.getAttribute('title'));
        if (nativeTitle && !target.dataset.tooltip) {
            target.dataset.tooltip = nativeTitle;
            target.removeAttribute('title');
        }

        this.removeDescription(this.currentTarget);
        this.pendingTarget = null;
        this.currentTarget = target;
        this.tooltip.textContent = text;
        this.tooltip.setAttribute('aria-hidden', 'false');
        this.addDescription(target);

        requestAnimationFrame(() => {
            if (this.currentTarget !== target) return;
            this.position(target);
            this.tooltip.classList.add('is-visible');
        });
    }

    hide() {
        clearTimeout(this.showTimer);
        this.showTimer = null;
        this.pendingTarget = null;
        this.removeDescription(this.currentTarget);
        this.currentTarget = null;
        if (!this.tooltip) return;
        this.tooltip.classList.remove('is-visible');
        this.tooltip.setAttribute('aria-hidden', 'true');
    }

    addDescription(target) {
        const tokens = normalizeText(target.getAttribute('aria-describedby'))
            .split(' ')
            .filter(Boolean);
        if (!tokens.includes(this.tooltip.id)) tokens.push(this.tooltip.id);
        target.setAttribute('aria-describedby', tokens.join(' '));
    }

    removeDescription(target) {
        if (!target || !this.tooltip) return;
        const tokens = normalizeText(target.getAttribute('aria-describedby'))
            .split(' ')
            .filter(token => token && token !== this.tooltip.id);
        if (tokens.length > 0) {
            target.setAttribute('aria-describedby', tokens.join(' '));
        } else {
            target.removeAttribute('aria-describedby');
        }
    }

    position(target) {
        const gap = 10;
        const viewportPadding = 12;
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const spaceAbove = targetRect.top;
        const placeBelow = spaceAbove < tooltipRect.height + gap + viewportPadding;

        const desiredLeft = targetRect.left
            + (targetRect.width / 2)
            - (tooltipRect.width / 2);
        const maxLeft = window.innerWidth - tooltipRect.width - viewportPadding;
        const left = Math.min(
            Math.max(viewportPadding, desiredLeft),
            Math.max(viewportPadding, maxLeft)
        );
        const top = placeBelow
            ? targetRect.bottom + gap
            : targetRect.top - tooltipRect.height - gap;

        this.tooltip.dataset.placement = placeBelow ? 'bottom' : 'top';
        this.tooltip.style.left = `${Math.round(left)}px`;
        this.tooltip.style.top = `${Math.round(top)}px`;
    }
}
