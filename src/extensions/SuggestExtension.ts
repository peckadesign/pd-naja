import { AfterUpdateEvent } from 'naja/dist/core/SnippetHandler'
import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'
import { Suggest, SuggestOptions } from '../classes/Suggest'
import { SpinnerPropsFn, SpinnerType } from '../types'
import { SpinnerExtension } from './SpinnerExtension'

declare module 'naja/dist/Naja' {
	interface Options {
		suggest?: Suggest
	}
}

export class SuggestExtension implements Extension {
	private requestQueue: Set<Request> = new Set()

	public readonly spinnerExtension: SpinnerExtension | undefined
	public readonly spinner: SpinnerType | undefined
	public readonly getSpinnerProps: SpinnerPropsFn | undefined

	public constructor(
		spinnerExtension: SpinnerExtension | undefined = undefined,
		spinner: SpinnerType | undefined = undefined,
		getSpinnerProps: SpinnerPropsFn = undefined
	) {
		this.spinnerExtension = spinnerExtension
		this.spinner = spinner
		this.getSpinnerProps = getSpinnerProps

		this.bindUI(document)
	}

	public initialize(naja: Naja): void {
		naja.snippetHandler.addEventListener('afterUpdate', (event: AfterUpdateEvent) => this.bindUI(event.detail.snippet))

		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))

		naja.addEventListener('start', this.start.bind(this))
		naja.addEventListener('complete', this.complete.bind(this))
	}

	private bindUI(context: Element | Document): void {
		const elements = context.querySelectorAll<HTMLElement>(`.${Suggest.className}`)

		elements.forEach((element) => {
			const form =
				element instanceof HTMLFormElement
					? element
					: element.querySelector<HTMLFormElement>(`.${Suggest.formClassName}`)

			// Prevent duplicate listener bindings when already initialized
			if (!form || form._suggest !== undefined) {
				return
			}

			const options = JSON.parse(element.dataset.suggest || '{}') as Partial<SuggestOptions>

			new Suggest(element, form, options, this.spinnerExtension, this.spinner, this.getSpinnerProps)
		})
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element, options } = event.detail

		const buttonElement = element as HTMLButtonElement
		if (buttonElement.classList.contains(Suggest.buttonClassName) && buttonElement.form?._suggest) {
			options.suggest = buttonElement.form._suggest
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
