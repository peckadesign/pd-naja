import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'
import { isDatasetTruthy } from '../utils'

declare module 'naja/dist/Naja' {
	interface Options {
		btnSpinnerInitiator?: Element
		btnSpinner?: Element
	}
}

type spinnerType = ((props?: any) => Element) | Element
type spinnerPropsFn = ((initiator: Element) => any) | undefined

export class BtnSpinnerExtension implements Extension {
	public readonly timeout: number
	public readonly spinner: spinnerType
	public readonly getSpinnerProps?: spinnerPropsFn

	public constructor(spinner: spinnerType, getSpinnerProps: spinnerPropsFn = undefined, timeout = 60000) {
		this.spinner = spinner
		this.getSpinnerProps = getSpinnerProps
		this.timeout = timeout

		// Handle non-ajax forms as well
		document.addEventListener('submit', (event: SubmitEvent) => {
			const form = event.target
			const button = form ? (form as HTMLFormElement)['nette-submittedBy'] : null

			if (
				!(form instanceof HTMLFormElement) ||
				!button ||
				isDatasetTruthy(button, 'noSpinner') ||
				isDatasetTruthy(button, 'noBtnSpinner')
			) {
				return true
			}

			const spinner = this.showSpinner(button)

			form.dataset.btnSpinnerTimeout = String(
				setTimeout(() => {
					this.hideSpinner(spinner)
					delete form.dataset.btnSpinnerTimeout
				}, this.timeout)
			)
		})
	}

	public initialize(naja: Naja): void {
		// AJAX forms and buttons
		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))

		naja.addEventListener('start', this.handleStartEvent.bind(this))
		naja.addEventListener('complete', this.handleCompleteEvent.bind(this))
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element } = event.detail

		if (isDatasetTruthy(element, 'najaBtnSpinner') || (element as HTMLElement).dataset.najaSpinner === 'btn') {
			event.detail.options.btnSpinnerInitiator = element
		}
	}

	private handleStartEvent(event: StartEvent): void {
		const { options } = event.detail

		if (!options.btnSpinnerInitiator) {
			return
		}

		options.btnSpinner = this.showSpinner(options.btnSpinnerInitiator)
	}

	private handleCompleteEvent(event: CompleteEvent): void {
		const { options } = event.detail

		if (options.forceRedirect || !options.btnSpinner) {
			return
		}

		this.hideSpinner(options.btnSpinner)
	}

	private showSpinner(button: Element): Element {
		let spinner: Element

		if (typeof this.spinner === 'function') {
			spinner = this.getSpinnerProps ? this.spinner(this.getSpinnerProps(button)) : this.spinner()
		} else {
			spinner = this.spinner
		}

		button.appendChild(spinner)
		spinner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100 })

		return spinner
	}

	private hideSpinner(spinner: Element): void {
		const animation = spinner.animate({ opacity: 0 }, { duration: 100 })
		animation.finished.then(() => spinner?.remove())
	}
}
