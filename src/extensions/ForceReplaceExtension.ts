import { Extension, Naja } from 'naja/dist/Naja'
import { BeforeUpdateEvent } from 'naja/dist/core/SnippetHandler'
import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { isDatasetTruthy } from '../utils'

declare module 'naja/dist/Naja' {
	interface Options {
		forceReplace?: boolean
	}
}

export class ForceReplaceExtension implements Extension {
	private naja: Naja | undefined

	public initialize(naja: Naja): void {
		this.naja = naja

		naja.uiHandler.addEventListener('interaction', this.checkForceReplace.bind(this))
		naja.snippetHandler.addEventListener('beforeUpdate', this.handleForceReplace.bind(this))
	}

	private checkForceReplace(event: InteractionEvent) {
		const { element, options } = event.detail

		options.forceReplace = isDatasetTruthy(element, 'najaSnippetForceReplace')
	}

	private handleForceReplace(event: BeforeUpdateEvent): void {
		const { changeOperation, options } = event.detail

		if (this.naja && options.forceReplace) {
			changeOperation(this.naja.snippetHandler.op.replace)
		}
	}
}
