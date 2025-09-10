import { Extension, Naja, SuccessEvent } from 'naja'

declare module 'naja' {
	interface Payload {
		followUpUrl?: string
	}
}

export class FollowUpRequestExtension implements Extension {
	public initialize(naja: Naja): void {
		naja.addEventListener('success', (event: SuccessEvent) => {
			const { payload } = event.detail

			if (payload.followUpUrl) {
				naja.makeRequest('get', payload.followUpUrl, null, { history: false })
			}
		})
	}
}
