import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { Extension, Naja, SuccessEvent } from 'naja/dist/Naja'
import { isDatasetTruthy } from '../utils'

declare module 'naja/dist/Naja' {
	interface Options {
		ajaxOnceInitiator?: HTMLElement | SVGElement
	}
}

export class AjaxOnceExtension implements Extension {
	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', this.checkAjaxOnce.bind(this))
		naja.addEventListener('success', this.success.bind(this))
	}

	private checkAjaxOnce(event: InteractionEvent): void {
		const { element, options } = event.detail

		if (!isDatasetTruthy(element, 'najaOnce')) {
			return
		}

		if (isDatasetTruthy(element, 'najaLoaded')) {
			event.preventDefault()
			return
		}

		options.ajaxOnceInitiator = element as HTMLElement | SVGElement
	}

	private success(event: SuccessEvent): void {
		const { options } = event.detail

		if (!options.ajaxOnceInitiator) {
			return
		}

		options.ajaxOnceInitiator.dataset.najaLoaded = 'true'
	}
}
