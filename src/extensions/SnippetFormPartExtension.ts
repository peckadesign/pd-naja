import { AfterUpdateEvent, Extension, Naja } from 'naja'

export class SnippetFormPartExtension implements Extension {
	private netteForms: any

	public initialize(naja: Naja): void {
		this.netteForms = naja.formsHandler.netteForms || (window as any).Nette

		if (!this.netteForms) {
			return
		}

		naja.snippetHandler.addEventListener('afterUpdate', this.checkSnippetFormPart.bind(this))
	}

	private checkSnippetFormPart(event: AfterUpdateEvent): void {
		const { snippet } = event.detail

		const closestForm = snippet.closest('form')

		if (closestForm) {
			this.netteForms.initForm(closestForm)
		}
	}
}
