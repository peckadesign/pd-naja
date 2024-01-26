import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'
import { Suggest } from '../classes/Suggest'
import { SpinnerPropsFn, SpinnerType } from '../types'

declare module 'naja/dist/Naja' {
	interface Options {
		suggest?: Suggest
	}
}

export class SuggestExtension implements Extension {
	private requestQueue: Set<Request> = new Set()

	public readonly spinner: SpinnerType | undefined
	public readonly getSpinnerProps?: SpinnerPropsFn

	public constructor(spinner: SpinnerType | undefined = undefined, getSpinnerProps: SpinnerPropsFn = undefined) {
		this.spinner = spinner
		this.getSpinnerProps = getSpinnerProps

		const forms = document.querySelectorAll<HTMLFormElement>(`.${Suggest.className}`)

		forms.forEach((form) => {
			new Suggest(form, {}, spinner, getSpinnerProps)
		})
	}

	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))
		naja.addEventListener('start', this.start.bind(this))
		naja.addEventListener('complete', this.complete.bind(this))
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element, options } = event.detail

		const inputElement = element as HTMLInputElement
		if (inputElement.form && inputElement.form._suggest) {
			options.suggest = inputElement.form._suggest
		}
	}

	private start(event: StartEvent): void {
		const { options, request } = event.detail

		if (options.suggest) {
			this.requestQueue.add(request)
			options.suggest.startSuggest()
		}
	}

	private complete(event: CompleteEvent): void {
		const { options, request } = event.detail

		if (!options.suggest) {
			return
		}

		this.requestQueue.delete(request)

		if (this.requestQueue.size === 0) {
			options.suggest.finishSuggest()
		}
	}
}
