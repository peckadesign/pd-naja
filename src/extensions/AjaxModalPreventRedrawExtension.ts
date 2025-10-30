import { BeforeEvent, Extension, InteractionEvent, Naja } from 'naja'

declare module 'naja' {
	interface Options {
		pdModalPreventRedraw?: boolean
	}
}

export class AjaxModalPreventRedrawExtension implements Extension {
	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', this.handleInteraction.bind(this))
		naja.addEventListener('before', this.handleBefore.bind(this))
	}

	private handleInteraction(event: InteractionEvent): void {
		const { element, options } = event.detail

		if (element.hasAttribute('data-naja-modal-prevent-redraw')) {
			options.pdModalPreventRedraw = true
		}
	}

	private handleBefore(event: BeforeEvent): void {
		const { options, request } = event.detail

		if (options.pdModalPreventRedraw) {
			request.headers.set('Pd-Modal-Prevent-Redraw', String(1))
		}
	}
}
