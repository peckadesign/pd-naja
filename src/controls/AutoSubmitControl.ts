import naja from 'naja'
import { Control } from '../types'
import { isDatasetTruthy } from '../utils'

const delayedTextInputs = [
	'text',
	'email',
	'search',
	'tel',
	'password',
	'url',
	'number',
	'date',
	'time',
	'datetime-local'
]

export class AutoSubmitControl implements Control {
	public static readonly selector = '.js-auto-submit'

	public initialize(context: Element | Document): void {
		const forms = context.querySelectorAll<HTMLFormElement>(AutoSubmitControl.selector)

		forms.forEach((form) => this.initializeForm(form))
	}

	private initializeForm(form: HTMLFormElement): void {
		const submit = form.querySelector<HTMLElement>(`${AutoSubmitControl.selector}__submit`)
		const timeout = form.dataset.autoSubmitTimeout ? parseInt(form.dataset.autoSubmitTimeout) : 200
		let timer: ReturnType<typeof setTimeout> | undefined = undefined

		// Delay submission for "text" like inputs where the user writes the input
		form.addEventListener('input', (event: Event | CustomEvent) => {
			if (
				!(event.target instanceof HTMLTextAreaElement) &&
				!(event.target instanceof HTMLInputElement && delayedTextInputs.includes(event.target.type))
			) {
				return
			}

			clearTimeout(timer)

			timer = setTimeout(() => this.handleChange(event.target as HTMLElement, submit, form), timeout)
		})

		// Submit immediately after input changed, unless the ` QuantityInput ` component triggered the change
		form.addEventListener('change', (event: Event | CustomEvent) => {
			if (
				event.target instanceof HTMLTextAreaElement ||
				(event.target instanceof HTMLInputElement &&
					delayedTextInputs.includes(event.target.type) &&
					((event as CustomEvent).detail === undefined || (event as CustomEvent).detail.isTrigger !== true))
			) {
				return
			}

			clearTimeout(timer)

			if ((event as CustomEvent).detail?.isTrigger) {
				timer = setTimeout(() => this.handleChange(event.target as HTMLElement, submit, form), timeout)
			} else {
				this.handleChange(event.target as HTMLElement, submit, form)
			}
		})
	}

	private handleChange(target: HTMLElement, fallbackSubmit: HTMLElement | null, form: HTMLFormElement): void {
		if (isDatasetTruthy(target, 'autoSubmitDisabled')) {
			return
		}

		// The element triggering the change may request a specific submit button by its `name` via
		// `data-auto-submit-submit`; otherwise the `.js-auto-submit__submit` fallback is used.
		const submitName = target.dataset.autoSubmitSubmit
		const submit = submitName
			? ((form.elements.namedItem(submitName) as HTMLElement | null) ?? fallbackSubmit)
			: fallbackSubmit

		if (submit) {
			submit.click()
		} else {
			naja.uiHandler.submitForm(form)
		}
	}
}
