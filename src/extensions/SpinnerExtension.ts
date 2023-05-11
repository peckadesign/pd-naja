import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'
import { InteractionEvent } from 'naja/dist/core/UIHandler'

/**
 * @author Radek Šerý
 *
 * Spinner - loading indicator:
 * 1. Extension can be turned off by using data-naja-spinner="off".
 * 2. If there is data-naja-spinner with different value, this value is used as a selector for element into which the
 *    Spinner is appended.
 * 3. If there is no data-naja-spinner, closest .ajax-wrap is being searched for and:
 *    a. If there is .ajax-spinner inside, this element is used for Spinner.
 *    b. If not, the Spinner is appended into .ajax-wrap itself.
 */

declare module 'naja/dist/Naja' {
	interface Options {
		spinnerInitiator?: Element
	}
}

type spinnerFn = (props?: any) => Element
type spinnerPropsFn = ((element: Element) => any) | undefined

export class SpinnerExtension implements Extension {
	public readonly getSpinner: spinnerFn
	public readonly getSpinnerProps?: spinnerPropsFn

	public readonly ajaxSpinnerWrapSelector: string
	public readonly ajaxSpinnerPlaceholderSelector: string

	public constructor(
		getSpinner: spinnerFn,
		getSpinnerProps: spinnerPropsFn = undefined,
		ajaxSpinnerWrapSelector = '.ajax-wrap',
		ajaxSpinnerPlaceholderSelector = '.ajax-spinner'
	) {
		this.getSpinner = getSpinner
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
				const spinner = this.getSpinnerProps
					? this.getSpinner(this.getSpinnerProps(spinnerInitiator))
					: this.getSpinner()

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

		if (spinner === 'off') {
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
