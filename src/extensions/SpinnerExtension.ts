import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'
import { InteractionEvent } from 'naja/dist/core/UIHandler'

/**
 * @author Radek Šerý
 *
 * Spinner - loading indicator:
 * 1. The extension can be disabled by using `data-naja-spinner="off"`.
 * 2. The extension is also disabled if `data-naja-spinner="btn"` is set. In this case the spinner rendering is up to
 *    `BtnSpinnerExtension`, which will be enabled automatically.
 * 3. If there is `data-naja-spinner` with different value, this value is used as a selector for element into which the
 *    spinner element is appended.
 * 4. If there is no `data-naja-spinner`, closest `ajaxSpinnerWrapSelector` is being searched for and:
 *    i.  If there is `ajaxSpinnerPlaceholderSelector` inside, this element is used for placing spinner element.
 *    ii. If not, the spinner element is appended into `ajaxSpinnerWrapSelector` itself.
 */

declare module 'naja/dist/Naja' {
	interface Options {
		spinnerInitiator?: Element
	}
}

type spinnerType = ((props?: any) => Element) | Element
type spinnerPropsFn = ((initiator: Element) => any) | undefined

export class SpinnerExtension implements Extension {
	public readonly spinner: spinnerType
	public readonly getSpinnerProps?: spinnerPropsFn

	public readonly ajaxSpinnerWrapSelector: string
	public readonly ajaxSpinnerPlaceholderSelector: string

	public constructor(
		spinner: spinnerType,
		getSpinnerProps: spinnerPropsFn = undefined,
		ajaxSpinnerWrapSelector = '.ajax-wrap',
		ajaxSpinnerPlaceholderSelector = '.ajax-spinner'
	) {
		this.spinner = spinner
		this.getSpinnerProps = getSpinnerProps

		this.ajaxSpinnerWrapSelector = ajaxSpinnerWrapSelector
		this.ajaxSpinnerPlaceholderSelector = ajaxSpinnerPlaceholderSelector
	}

	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', this.getSpinnerInitiator.bind(this))

		naja.addEventListener('start', this.showSpinners.bind(this))
		naja.addEventListener('complete', this.hideSpinners.bind(this))
	}

	private getSpinnerInitiator(event: InteractionEvent): void {
		event.detail.options.spinnerInitiator = event.detail.element
	}

	private showSpinners(event: StartEvent): void {
		const { options } = event.detail

		if (!options.spinnerInitiator) {
			return
		}

		const spinnerInitiator = options.spinnerInitiator
		const placeholders = this.getPlaceholders(spinnerInitiator)

		if (placeholders.length === 0) {
			return
		} else {
			options.spinnerQueue = options.spinnerQueue || []

			placeholders.forEach((placeholder) => {
				let spinner: Element

				if (typeof this.spinner === 'function') {
					spinner = this.getSpinnerProps ? this.spinner(this.getSpinnerProps(spinnerInitiator)) : this.spinner()
				} else {
					spinner = this.spinner
				}

				placeholder.appendChild(spinner)
				options.spinnerQueue.push(spinner)

				spinner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100 })
			})
		}
	}

	private hideSpinners(event: CompleteEvent): void {
		const { options } = event.detail

		if (options.forceRedirect) {
			return
		}

		options.spinnerQueue?.forEach((spinner: Element) => {
			const animation = spinner.animate({ opacity: 0 }, { duration: 100 })
			animation.finished.then(() => spinner.remove())
		})
	}

	private getPlaceholders(element: Element): Element[] {
		if (!element) {
			return []
		}

		const spinner = element.getAttribute('data-naja-spinner') || null
		let placeholders: Element[] = []

		if (spinner === 'off' || spinner === 'false' || spinner === 'btn') {
			return []
		}

		placeholders = this.getPlaceholdersByQuerySelector(spinner)

		return placeholders.length ? placeholders : this.getPlaceholdersByDOM(element)
	}

	private getPlaceholdersByQuerySelector(selector: string | null): Element[] {
		return selector ? Array.from(document.querySelectorAll(selector)) : []
	}

	private getPlaceholdersByDOM(element: Element): Element[] {
		const wrap = element.closest(this.ajaxSpinnerWrapSelector)

		if (wrap === null) {
			return []
		}

		const placeholders = wrap.querySelectorAll(this.ajaxSpinnerPlaceholderSelector)

		return placeholders.length ? Array.from(placeholders) : [wrap]
	}
}
