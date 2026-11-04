import { BuildStateEvent, Extension, HistoryState, Naja } from 'naja'
import type { AjaxModal } from './AjaxModalExtension'

export class AjaxModalUnderlyingPageLinkExtension implements Extension {
	private naja: Naja | undefined
	private readonly modal: AjaxModal

	// URL of the last non-modal state the document has shown, used when the modal is opened from the history.
	private lastNonModalUrl: string | null

	// URL of the page under the modal, taken at the moment the modal is opened.
	private underlyingPageUrl: string | null = null

	private pendingHash: string | null = null

	public constructor(modal: AjaxModal) {
		this.modal = modal
		this.lastNonModalUrl = this.isPdModalState(history.state) ? null : window.location.href

		window.addEventListener('popstate', this.popstateHandler.bind(this))
		document.addEventListener('ajaxModalClosed', this.closedHandler.bind(this))
	}

	public getUnderlyingPageUrl(): string | null {
		return this.underlyingPageUrl
	}

	public initialize(naja: Naja): void {
		this.naja = naja

		naja.historyHandler.addEventListener('buildState', this.buildStateHandler.bind(this))

		this.modal.onShow(this.showHandler.bind(this))
		this.modal.element.addEventListener('click', this.clickHandler.bind(this))
	}

	private isPdModalState(state: HistoryState | null): boolean {
		return state !== null && typeof state === 'object' && 'pdModal' in state
	}

	private popstateHandler(event: PopStateEvent): void {
		if (!this.isPdModalState(event.state)) {
			this.lastNonModalUrl = window.location.href
		}
	}

	// `AjaxModalExtension` adds `pdModal` to the state in its own `buildState` handler, so this extension has to be
	// registered after it.
	private buildStateHandler(event: BuildStateEvent): void {
		const { isInitial, state } = event.detail

		if (!isInitial && !this.isPdModalState(state)) {
			this.lastNonModalUrl = state.href
		}
	}

	private showHandler(): void {
		// When the modal is opened from the history, the current state is already the modal one.
		this.underlyingPageUrl = this.isPdModalState(history.state) ? this.lastNonModalUrl : window.location.href
	}

	private closedHandler(): void {
		const hash = this.pendingHash

		this.underlyingPageUrl = null
		this.pendingHash = null

		if (!this.isPdModalState(history.state)) {
			this.lastNonModalUrl = window.location.href
		}

		// Waiting for the next frame lets the browser restore the scroll position of the history entry first, which
		// would otherwise cancel the (possibly smooth) scrolling.
		if (hash && hash.length > 1) {
			const url = new URL(window.location.href)
			url.hash = hash
			history.replaceState(history.state, '', url)

			window.requestAnimationFrame(() => {
				const target = this.getHashTarget(hash)

				if (!target) {
					return
				}

				this.focusTarget(target)
				target.scrollIntoView()
			})
		}
	}

	// The modal returns the focus to its opener, so the sequential focus navigation would continue from there instead
	// of the hash target.
	private focusTarget(target: HTMLElement): void {
		target.focus({ preventScroll: true })

		if (document.activeElement === target) {
			return
		}

		target.setAttribute('tabindex', '-1')
		target.focus({ preventScroll: true, focusVisible: false })

		// The temporary `tabindex` is removed on blur, so the element does not stay a click focus target. When the
		// element cannot be focused even with it (e.g. it is hidden), the blur would never come.
		if (document.activeElement === target) {
			target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true })
		} else {
			target.removeAttribute('tabindex')
		}
	}

	private getHashTarget(hash: string): HTMLElement | null {
		try {
			return document.getElementById(decodeURIComponent(hash.slice(1)))
		} catch {
			return null
		}
	}

	private opensInOtherContext(link: HTMLAnchorElement): boolean {
		const target = link.target || document.querySelector('base[target]')?.getAttribute('target') || ''

		return target !== '' && target.toLowerCase() !== '_self'
	}

	private clickHandler(event: Event): void {
		if (!(event instanceof MouseEvent)) {
			return
		}

		const isModifiedClick = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey

		if (event.defaultPrevented || event.button !== 0 || isModifiedClick || this.underlyingPageUrl === null) {
			return
		}

		const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')

		// Ajax links inside the modal navigate within the modal, they are handled by Naja.
		const isAjaxLink = this.naja?.uiHandler.selector ? link?.matches(this.naja.uiHandler.selector) : false

		if (!link || isAjaxLink || this.opensInOtherContext(link) || link.hasAttribute('download')) {
			return
		}

		const url = new URL(link.href)
		const underlyingPageUrl = new URL(this.underlyingPageUrl)

		// The query is not compared, Ajax requests outside the modal (e.g. filters) change it without a page load.
		if (url.origin !== underlyingPageUrl.origin || url.pathname !== underlyingPageUrl.pathname) {
			return
		}

		event.preventDefault()

		this.pendingHash = url.hash
		this.modal.hide(event)
	}
}
