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
	pdModal: PdModalState
}

type CallbackFn = (callback: EventListener) => void

export interface AjaxModal {
	// main element of the modal
	element: Element

	// id's of snippets, that are necessary for modal function
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

interface HistoryStateWrapper extends Record<string, any> {
	location: string
	state: HistoryState
	title: string
}

type HistoryDirection = 'forwards' | 'backwards'

interface PdModalState {
	historyDirection: HistoryDirection
	opener: string // stringified Element
	options: any
}

export class AjaxModalExtension implements Extension {
	private readonly modal: AjaxModal
	private readonly uniqueExtKey: string = 'modal'

	private popstateFlag = false
	private hidePopstateFlag = false

	private historyEnabled = false // (dis)allows `pushState` after hiding the modal when going back in history (popstate), we don't want to push new state into history same is true also when the history is disabled for request altogether
	private historyDirection: HistoryDirection = 'backwards'

	private shouldPreventSnippetFetch = false

	private modalOptions: any = {}

	private original: HistoryStateWrapper[] = [] // stack of states under the modal after hiding the modal with `forwards` history mode, we need to push the previous state
	private lastState: HistoryStateWrapper | null = null
	private initialState: HistoryState | Record<string, never>

	private readonly abortControllers: Map<string, AbortController> = new Map()

	public constructor(modal: AjaxModal) {
		// Extension popstate has to be executed before naja popstate, so we can correctly detect if the pdModal is
		// opened. Therefore, we bind the callback before the extension initialization itself.
		window.addEventListener('popstate', this.popstateHandler.bind(this))

		this.modal = modal
		this.initialState = history.state || {}
	}

	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))

		naja.historyHandler.addEventListener('buildState', this.buildState.bind(this))

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

	private restoreExtensionPropertiesFromState = (state: PdModalHistoryState): void => {
		this.historyEnabled = true // Called from popstateHandler means the history is enabled
		this.historyDirection = state.pdModal.historyDirection
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

		// If the extension is enabled and the modal is not opened, we detect and store history mode. History mode
		// cannot change when traversing an ajax link inside modal, it stays the same until modal is hidden.
		if (!this.modal.isShown()) {
			this.historyDirection = element.getAttribute('data-naja-modal-history') === 'forwards' ? 'forwards' : 'backwards'
		}
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

	private buildState(event: BuildStateEvent): void {
		const { operation, options, state } = event.detail

		// Always add a `title` into the state, so we can retrieve it when needed after closing the modal. See
		// `popstateHandler` below.
		if (!state.title) {
			state.title = document.title
		}

		// If this is called from Naja's `replaceInitialState`, we don't change the state.
		//
		// This is a possible weakness because this condition could be true even with actual user interaction, if
		// Naja's first interaction is with an element with `data-naja-history="replace"`. In this case the condition
		// will also be true, but it is probably the desired behaviour to save this state as non-modal anyway, since
		// the initial state should (or could) never be opened in a modal.
		if (operation === 'replaceState' && state.cursor === 0) {
			// If there already is `pdModal` configuration in history state, we need to preserve that configuration.
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
				historyDirection: this.historyDirection,
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
			request.headers.append('Pd-Modal-Prevent-Redraw', String(1))

			return
		}

		this.modal.show(options.modalOpener, options.modalOptions, event)
	}

	private success(event: SuccessEvent): void {
		const { options, payload } = event.detail

		this.popstateFlag = false
		this.lastState = {
			location: location.href,
			state: history.state,
			title: document.title
		}

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

		// If the modal history mode is `forwards`, we store the state under the modal, so we can push it as a new state
		// after hiding the modal.
		if (this.historyDirection === 'forwards') {
			if (this.popstateFlag && this.lastState) {
				this.original.push(this.lastState)
			} else {
				const state: HistoryStateWrapper = {
					location: location.href,
					state: history.state,
					title: document.title
				}
				this.original.push(state)
			}
		}
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
		// This method is called after the modal has been hidden. It either pushes a new state into history (mode
		// `forwards`) or calls `history.back()` to start go-back procedure.
		//
		// A new state is pushed only if we are able to retrieve the state under the modal (which should have been
		// stored previously), and the modal is not being closed using forward / back buttons in the browser.
		if (!this.historyEnabled) {
			return
		}

		if (this.historyDirection === 'backwards') {
			// We don't know how many states we need to return. We go one by one, see popstate handler. This go-back
			// procedure is detected using `hidePopstateFlag`.
			this.hidePopstateFlag = true
			this.cleanData()
			window.history.back()
		} else if (this.historyDirection === 'forwards') {
			const state = this.original.pop()
			this.original = []

			if (state) {
				// When closing the modal using forward / back buttons in the browser, the current state is the same as
				// the one stored in `this.original`. If that's the case, we don't push anything as it would duplicate
				// the state in history.
				if (history.state === undefined || history.state.href !== state.location) {
					history.pushState(state.state, state.title, state.location)
					document.title = state.title

					this.popstateFlag = false
					this.lastState = {
						location: state.location,
						state: state.state,
						title: state.title
					}
				}
			}

			this.cleanData()
		}
	}

	private popstateHandler(event: PopStateEvent): void {
		const state: HistoryState = event.state || this.initialState

		if (typeof state === 'undefined' || !this.modal) {
			return
		}

		const isCurrentStatePdModal = this.isPdModalState(state)
		this.popstateFlag = true
		this.shouldPreventSnippetFetch = false

		// We don't know how many states we go back. So we go one by one until the new state is not a modal state
		// (`isPdModalState` is `false`).
		if (this.hidePopstateFlag) {
			// We don't want the naja popstate callback to be executed (or any other popstate handler).
			event.stopImmediatePropagation()

			// If the `state.cursor` is 0, the page has been refreshed, and we don't want to go back in history any
			// more.
			if (isCurrentStatePdModal && state.cursor !== 0) {
				window.history.back()

				return
			} else {
				if (state.title) {
					document.title = state.title
				}
			}

			this.hidePopstateFlag = false
		}

		// We check if the state has a ` pdModal ` object present on popstate. If so, we proceed to open the modal.
		// Naja itself restores the content of the modal (either from cache or by new request).
		//
		// If the initial state is also detected as a pdModal state, we returned to some pdModal state using reload. In
		// that case, we don't want to open the modal because we might be missing some snippets. Effectively this means
		// that the modal will never be opened by the forward / back button if there has been some other site loaded
		// outside the modal (e.g. some non-ajax links leading from modal).
		if (isCurrentStatePdModal && !this.isPdModalState(this.initialState)) {
			this.restoreExtensionPropertiesFromState(state)

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

		// Keep track of the current state. When the ` backwards ` history mode is used, we eventually push this state into
		// `this.original`.
		this.lastState = {
			location: location.href,
			state: state,
			title: document.title
		}
	}

	private cleanData(): void {
		this.historyEnabled = false
		this.historyDirection = 'backwards'
		this.modalOptions = null
	}

	private getElementFromString(stringElement: string): Element {
		return new DOMParser().parseFromString(stringElement, 'text/html').body.firstElementChild as Element
	}
}
