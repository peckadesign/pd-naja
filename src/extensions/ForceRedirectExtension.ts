import { Extension, Naja, PayloadEvent, SuccessEvent } from 'naja'

declare module 'naja' {
	interface Payload {
		forceRedirect?: string
	}
}

export class ForceRedirectExtension implements Extension {
	private naja: Naja | undefined

	public initialize(naja: Naja): void {
		this.naja = naja

		naja.addEventListener('payload', this.prepareOptions.bind(this))
		naja.addEventListener('success', this.handleForceRedirect.bind(this))
	}

	private prepareOptions(event: PayloadEvent): void {
		const { payload, options } = event.detail

		if (payload.forceRedirect) {
			options.forceRedirect = true
		}
	}

	private handleForceRedirect(event: SuccessEvent): void {
		const { payload } = event.detail

		if (payload.forceRedirect) {
			this.naja?.redirectHandler.makeRedirect(payload.forceRedirect, true)
			event.stopImmediatePropagation()
		}
	}
}
