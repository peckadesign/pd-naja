import { Naja, BeforeEvent, CompleteEvent, StartEvent, SuccessEvent, Options, Extension } from 'naja/dist/Naja'
import { BuildStateEvent, HistoryState } from 'naja/dist/core/HistoryHandler'
import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { FetchEvent } from 'naja/dist/core/SnippetCache'

declare module 'naja/dist/Naja' {
	interface Options {
		pdModal?: boolean
		modalOpener?: Element
		modalOptions?: any
	}

	interface Payload {
		closeModal?: boolean
	}
}

interface OptionsWithPdModal extends Options {
	modalOpener: Element
	modalOptions: any
}

interface PdModalHistoryState extends HistoryState {
	title: string
	pdModal: PdModalState
}

type CallbackFn = (callback: EventListener) => void

export interface AjaxModal {
	// main element of the modal
	element: Element

	// id's of snippets that are necessary for modal function
	reservedSnippetIds: string[]

	show(opener: Element, options: any, event: BeforeEvent | PopStateEvent): void
	hide(event: SuccessEvent | PopStateEvent): void
	isShown(): boolean

	onShow: CallbackFn
	onHide: CallbackFn
	onHidden: CallbackFn

	dispatchLoad?: (options: any, event: SuccessEvent | PopStateEvent) => void

	getOptions(opener: Element): any
	setOptions(options: any): void
}

interface PdModalState {
	opener: string // stringified Element
	options: any
	refreshed?: boolean
}

export class AjaxModalExtension implements Extension {
	private naja: Naja | undefined
	private readonly modal: AjaxModal
	private readonly uniqueExtKey: string = 'modal'

	private popstateFlag = false
	private hidePopstateFlag = false

	private historyEnabled = false // (dis)allows `pushState` after hiding the modal when going back in history (popstate), we don't want to push new state into history same is true also when the history is disabled for request altogether

	private shouldPreventSnippetFetch = false

	private modalOptions: any = {}

	private initialState: HistoryState | Record<string, never>

	private readonly abortControllers: Map<string, AbortController> = new Map()

	public constructor(modal: AjaxModal) {
		// Extension popstate has to be executed before naja popstate, so we can correctly detect if the pdModal is
		// opened. Therefore, we bind the callback before the extension initialization itself.
		window.addEventListener('popstate', this.popstateHandler.bind(this))

		this.modal = modal
		this.initialState = history.state || {}

		// If the initial state already contains pdModal property, it means that the page with modal has been refreshed.
		// We take a note of this, so we can properly handle modal closing
		if (this.initialState.pdModal !== undefined) {
			;(this.initialState.pdModal as PdModalState).refreshed = true
		}
	}

	public initialize(naja: Naja): void {
		this.naja = naja

		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))

		naja.historyHandler.addEventListener('buildState', this.buildStateHandler.bind(this))

		naja.snippetCache.addEventListener('fetch', this.onSnippetFetch.bind(this))

		naja.addEventListener('before', this.before.bind(this))
		naja.addEventListener('start', this.abortPreviousRequest.bind(this))
		naja.addEventListener('success', this.success.bind(this))
		naja.addEventListener('complete', this.clearRequest.bind(this))

		this.modal.onShow(this.showHandler.bind(this))
		this.modal.onHide(this.hideHandler.bind(this))
		this.modal.onHidden(this.hiddenHandler.bind(this))
	}

	private isRequestWithHistory = (options: Options): boolean => {
		return options.history !== false
	}

	private isPdModalRequest = (options: Options): options is OptionsWithPdModal => {
		return Boolean(options.pdModal) && !options.pdModalPreventRedraw
	}

	private isPdModalState = (state: HistoryState | Record<string, never>): state is PdModalHistoryState => {
		return 'pdModal' in state
	}

	private isCurrentStateInitial(state: PdModalHistoryState): boolean {
		return (
			state.source === 'naja' &&
			this.initialState.source === 'naja' &&
			state.href === this.initialState.href &&
			state.title === this.initialState.title &&
			JSON.stringify(state.pdModal) === JSON.stringify(this.initialState.pdModal)
		)
	}

	private restoreExtensionPropertiesFromState = (state: PdModalHistoryState): void => {
		this.historyEnabled = true // Called from popstateHandler means the history is enabled
		this.modalOptions = state.pdModal.options
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element, options } = event.detail

		options.pdModal =
			this.modal.isShown() ||
			element.hasAttribute('data-naja-modal') ||
			(element as HTMLInputElement).form?.hasAttribute('data-naja-modal')

		if (!this.isPdModalRequest(options)) {
			return
		}

		// `modalOptions` will be stored in the state; therefore, no `Element` is allowed. These options are also
		// forwarded to other Naja event handlers via `options`. We also store the elements separately to be used there
		// as well.
		this.modalOptions = this.modal.getOptions(element)

		options.modalOptions = this.modalOptions
		options.modalOpener = element
	}

	private onSnippetFetch(event: FetchEvent): void {
		// When the snippet cache is off, this method is called to construct Naja request options. We retrieve modal
		// `options` from the original state in history if necessary. Also, when closing the modal from `PopstateEvent`,
		// we don't need to make a new request, so we call `event.preventDefault()` in that case.
		const { state } = event.detail

		if (this.isPdModalState(state)) {
			event.detail.options.pdModal = true
			event.detail.options.modalOpener = this.getElementFromString(state.pdModal.opener)
			event.detail.options.modalOptions = state.pdModal.options
		}

		if (this.shouldPreventSnippetFetch) {
			event.preventDefault()
			this.shouldPreventSnippetFetch = false
		}
	}

	private removeModalSnippetsIds(): void {
		// When closing the modal, we don't want to update any snippets inside it when other requests finishes. This
		// will ensure that snippets that might be also outside the modal (e.g. flash messages) will be redrawn outside
		// the modal. Therefore, we remove the id attributes, so no snippet is found.
		//
		// Some snippets are necessary for a modal function
		this.modal.element.querySelectorAll('[id^="snippet-"]').forEach((snippet) => {
			if (!this.modal.reservedSnippetIds.includes(snippet.id)) {
				snippet.removeAttribute('id')
			}
		})
	}

	private abortPreviousRequest(event: StartEvent): void {
		const { abortController, options } = event.detail
		if (this.isPdModalRequest(options)) {
			this.abortControllers.get(this.uniqueExtKey)?.abort()
			this.abortControllers.set(this.uniqueExtKey, abortController)
		}
	}

	private clearRequest(event: CompleteEvent): void {
		const { request } = event.detail
		if (!request.signal.aborted) {
			this.abortControllers.delete(this.uniqueExtKey)
		}
	}

	private buildStateHandler(event: BuildStateEvent): void {
		const { isInitial, options, state } = event.detail

		// Always add a `title` into the state, so we can retrieve it when needed after closing the modal. See
		// `popstateHandler` below.
		if (!state.title) {
			state.title = document.title
		}

		// If this is called from Naja's `replaceInitialState`, we don't change the state. Only if there already is a
		// `pdModal` in the current history state, we need to preserve that configuration.
		if (isInitial) {
			if (window.history.state?.pdModal) {
				state.pdModal = window.history.state.pdModal
			}

			return
		}

		// Every time naja builds the state, and we have the modal opened, we extend the state with a ` pdModal ` object
		// containing information about the modal being opened and what history mode is in use. When
		// `options.forceRedirect` is set, modal might be open but the new state will be redirected outside it.
		const isShown: boolean = this.isPdModalRequest(options) && !options.forceRedirect

		if (isShown) {
			state.pdModal = {
				opener: (options.modalOpener as Element).outerHTML, // if `this.modal.isShown()` is true, the `modalOpener` has been stored
				options: this.modalOptions
			}
		}

		// If the state is build, the history is enabled. This information is needed inside modal callback where the
		// options are not available, so we store this internally in extension.
		this.historyEnabled = true
	}

	private before(event: BeforeEvent): void {
		const { options, request } = event.detail
		const isPdModalRequest = this.isPdModalRequest(options)

		// Set the header according to the modal being already opened or to be opened.
		request.headers.append('Pd-Modal-Opened', String(Number(this.modal.isShown() || isPdModalRequest)))

		if (!isPdModalRequest) {
			// If the request is not pdModal request, we will prevent modal redraw.
			request.headers.set('Pd-Modal-Prevent-Redraw', String(1))

			return
		}

		this.modal.show(options.modalOpener, options.modalOptions, event)
	}

	private success(event: SuccessEvent): void {
		const { options, payload } = event.detail

		this.popstateFlag = false

		if (!this.isPdModalRequest(options)) {
			return
		}

		const requestHistory = this.isRequestWithHistory(options)

		// If the history is disabled for the current request, we will disable it for all ajax links / forms in modal as
		// well.
		if (!requestHistory && event.target) {
			const ajaxified = this.modal.element.querySelectorAll<HTMLElement>((event.target as Naja).uiHandler?.selector)

			ajaxified.forEach((element: HTMLElement) => {
				element.setAttribute('data-naja-history', 'off')
			})
		}

		if (payload.closeModal) {
			this.modal.hide(event)
		} else {
			this.modal.setOptions(this.modalOptions)

			if (this.modal.dispatchLoad) {
				this.modal.dispatchLoad(this.modalOptions, event)
			}
		}
	}

	private showHandler(): void {
		this.modal.setOptions(this.modalOptions)
	}

	private hideHandler(event: Event): void {
		const opener = (event as CustomEvent).detail?.opener as Element | undefined
		const abortable = opener
			? (opener.getAttribute('data-naja-abort') ??
					(opener as HTMLInputElement).form?.getAttribute('data-naja-abort')) !== 'off'
			: true

		this.removeModalSnippetsIds()

		if (abortable) {
			this.abortControllers.get(this.uniqueExtKey)?.abort()
		}
	}

	private hiddenHandler(): void {
		// This method is called after the modal has been hidden. It calls `history.back()` to start go-back procedure
		// to eventually return to the state leading to opening the modal.
		if (!this.historyEnabled) {
			return
		}

		// We don't know how many states we need to return. We go one by one, see popstate handler. This go-back
		// procedure is detected using `hidePopstateFlag`.
		this.hidePopstateFlag = true
		this.cleanData()
		window.history.back()
	}

	private popstateHandler(event: PopStateEvent): void {
		const state: HistoryState = (event.state || this.initialState) as HistoryState

		if (typeof state === 'undefined' || !this.modal) {
			return
		}

		const isCurrentStatePdModal = this.isPdModalState(state)
		this.popstateFlag = true
		this.shouldPreventSnippetFetch = false

		// This part handles the history back procedure.
		//
		// We don't know how many states we go back. So we go one by one until the new state is not a modal state
		// (`isPdModalState` is `false`).
		if (this.hidePopstateFlag) {
			// We don't want the naja popstate callback to be executed (or any other popstate handler). Naja would
			// update snippets which are not desired - we either continue going back in history, or we just closed the
			// modal, so no restoration is needed.
			event.stopImmediatePropagation()

			// Going back in history is undesirable even when the state is `pdModal` state, but the page has been
			// refreshed. We can check this by checking if the `pdModal.refreshed` property is set to `true`. Because a
			// user can skip multiple states using the browser back button, we also compare `this.initialState` with the
			// current `state`. If the (refreshed) `pdModal` state is the same as the initial state, we don't want to go
			// back in history.
			//
			// We should reevaluate this code when the issue is resolved: https://github.com/naja-js/naja/issues/418. We
			// may, possibly, use `state.cursor > 0` to check if the state is not the initial state.
			if (isCurrentStatePdModal && (state.pdModal.refreshed !== true || !this.isCurrentStateInitial(state))) {
				window.history.back()

				return
			} else if (state.title) {
				document.title = state.title
			}

			this.hidePopstateFlag = false
		}

		// This part handles the history forward procedure.
		//
		// This We check if the state has a ` pdModal ` object present on popstate. If so, we proceed to open the modal.
		// Naja itself restores the content of the modal (either from cache or by new request).
		//
		// If the initial state is also detected as a pdModal state, we returned to some pdModal state using reload. In
		// that case, we don't want to open the modal because we might be missing some snippets. Effectively this means
		// that the modal will never be opened by the forward / back button if there has been some other site loaded
		// outside the modal (e.g. some non-ajax links leading from modal).
		if (isCurrentStatePdModal && !this.isPdModalState(this.initialState)) {
			this.restoreExtensionPropertiesFromState(state)

			if (state.pdModal.refreshed === true) {
				this.resetPdModalRefreshed(state)
			}

			this.modal.show(this.getElementFromString(state.pdModal.opener), state.pdModal.options, event)

			// If there is some snippet cache, we might restore modal options. If not, options will be restored based on
			// options after the ajax request. The same applies to dispatching the load event - if the cache is on, we
			// dispatch the event immediately (after the restore has actually happened, see below); otherwise it is
			// dispatched after the ajax request.
			if (state.snippets?.storage !== 'off') {
				this.modal.setOptions(state.pdModal.options)

				// We need to delay the load dispatch after the naja has restored the snippets. Unfortunately, there is
				// no event after the snippets have been restored, only the `restore` event, which is dispatched before
				// the actual restore.
				setTimeout(() => {
					if (this.modal.dispatchLoad) {
						this.modal.dispatchLoad(this.modalOptions, event)
					}
				}, 0)
			}
		} else {
			this.historyEnabled = false // Hiding modal using the forward / back button, we disable the history to prevent state duplication

			// Reload the page if the initial state has been inside modal. This prevents snippet loss e.g. during
			// layout changes.
			if (this.isPdModalState(this.initialState)) {
				window.location.reload()
			}

			// Non-modal state and non-modal initial state → we just hide the current modal and prevent snippet fetch
			// (if the snippet cache is off).
			if (this.modal.isShown()) {
				this.modal.hide(event)
				this.shouldPreventSnippetFetch = true
			}
		}
	}

	private resetPdModalRefreshed(state: PdModalHistoryState): void {
		state.pdModal.refreshed = false

		this.naja?.historyHandler.historyAdapter.replaceState(state, document.title, state.href)
	}

	private cleanData(): void {
		this.historyEnabled = false
		this.modalOptions = null
	}

	private getElementFromString(stringElement: string): Element {
		return new DOMParser().parseFromString(stringElement, 'text/html').body.firstElementChild as Element
	}
}
