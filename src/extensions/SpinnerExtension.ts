import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'
import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { SpinnerPropsFn, SpinnerType, WithSpinner } from '../types'
import { hideSpinner, showSpinner } from '../utils'

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

export class SpinnerExtension implements Extension, WithSpinner {
	public readonly spinner: SpinnerType
	public readonly getSpinnerProps: SpinnerPropsFn

	public readonly ajaxSpinnerWrapSelector: string
	public readonly ajaxSpinnerTargetSelector: string

	public constructor(
		spinner: SpinnerType,
		getSpinnerProps: SpinnerPropsFn = undefined,
		ajaxSpinnerWrapSelector = '.ajax-wrap',
		ajaxSpinnerPlaceholderSelector = '.ajax-spinner'
	) {
		this.spinner = spinner
		this.getSpinnerProps = getSpinnerProps

		this.ajaxSpinnerWrapSelector = ajaxSpinnerWrapSelector
		this.ajaxSpinnerTargetSelector = ajaxSpinnerPlaceholderSelector
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
		const placeholders = this.getTargets(spinnerInitiator)

		if (placeholders.length === 0) {
			return
		} else {
			options.spinnerQueue = options.spinnerQueue || []

			placeholders.forEach((placeholder) => {
				options.spinnerQueue.push(showSpinner.call(this, placeholder, spinnerInitiator))
			})
		}
	}

	private hideSpinners(event: CompleteEvent): void {
		const { options } = event.detail

		if (options.forceRedirect) {
			return
		}

		options.spinnerQueue?.forEach((spinner: Element) => hideSpinner(spinner))
	}

	private getTargets(element: Element): Element[] {
		if (!element) {
			return []
		}

		const spinner = element.getAttribute('data-naja-spinner') || null
		let placeholders: Element[] = []

		if (spinner === 'off' || spinner === 'false' || spinner === 'btn') {
			return []
		}

		placeholders = this.getTargetsByQuerySelector(spinner)

		return placeholders.length ? placeholders : this.getTargetsByDOM(element)
	}

	private getTargetsByQuerySelector(selector: string | null): Element[] {
		return selector ? Array.from(document.querySelectorAll(selector)) : []
	}

	public getTargetsByDOM(element: Element): Element[] {
		const wrap = element.closest(this.ajaxSpinnerWrapSelector)

		if (wrap === null) {
			return []
		}

		const placeholders = wrap.querySelectorAll(this.ajaxSpinnerTargetSelector)

		return placeholders.length ? Array.from(placeholders) : [wrap]
	}
}
