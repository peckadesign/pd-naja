import { Extension, InteractionEvent, Naja } from 'naja'

export class ConfirmExtension implements Extension {
	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', (event: InteractionEvent) => {
			const { element } = event.detail

			const confirm = element.getAttribute('data-confirm')

			if (confirm && !window.confirm(confirm)) {
				event.preventDefault()
			}
		})
	}
}
