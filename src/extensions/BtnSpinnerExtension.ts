import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'
import { SpinnerPropsFn, SpinnerType, WithSpinner } from '../types'
import { hideSpinner, isDatasetTruthy, showSpinner } from '../utils'

declare module 'naja/dist/Naja' {
	interface Options {
		btnSpinnerInitiator?: Element
		btnSpinner?: Element
	}
}

export class BtnSpinnerExtension implements Extension, WithSpinner {
	public readonly timeout: number
	public readonly spinner: SpinnerType
	public readonly getSpinnerProps: SpinnerPropsFn

	private ajaxFormSelector: string | undefined

	public constructor(spinner: SpinnerType, getSpinnerProps: SpinnerPropsFn = undefined, timeout = 60000) {
		this.spinner = spinner
		this.getSpinnerProps = getSpinnerProps
		this.timeout = timeout

		// Handle non-ajax forms as well
		document.addEventListener('submit', (event: SubmitEvent) => {
			const form = event.target
			const button = form ? (form as HTMLFormElement)['nette-submittedBy'] : null

			// Skip if the form or button is missing, or if the form is handled by Naja, or if the button explicitly
			// disables the extension.
			if (
				!(form instanceof HTMLFormElement) ||
				!button ||
				(this.ajaxFormSelector && (form.matches(this.ajaxFormSelector) || button.matches(this.ajaxFormSelector))) ||
				isDatasetTruthy(button, 'noSpinner') ||
				isDatasetTruthy(button, 'noBtnSpinner')
			) {
				return true
			}

			const spinner = showSpinner.call(this, button)

			form.dataset.btnSpinnerTimeout = String(
				setTimeout(() => {
					hideSpinner(spinner)
					delete form.dataset.btnSpinnerTimeout
				}, this.timeout)
			)
		})
	}

	public initialize(naja: Naja): void {
		this.ajaxFormSelector = naja.uiHandler.selector

		// AJAX forms and buttons
		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))

		naja.addEventListener('start', this.handleStartEvent.bind(this))
		naja.addEventListener('complete', this.handleCompleteEvent.bind(this))

		// On redirect, remove the `btnSpinnerInitiator` from the options. This will prevent another spinner being
		// created (the spinner is preserved in `handleCompleteEvent` when `payload.redirect` is set).
		naja.redirectHandler.addEventListener('redirect', (event) => delete event.detail.options.btnSpinnerInitiator)
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

		options.btnSpinner = showSpinner.call(this, options.btnSpinnerInitiator)
	}

	private handleCompleteEvent(event: CompleteEvent): void {
		const { options, payload } = event.detail

		if (options.forceRedirect || !options.btnSpinner || payload?.redirect) {
			return
		}

		hideSpinner(options.btnSpinner)
	}
}
