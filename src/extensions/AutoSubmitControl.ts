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

class AutoSubmitControl implements Control {
	public static readonly selector = '.js-auto-submit'

	public initialize(context: Element | Document): void {
		const forms = context.querySelectorAll<HTMLFormElement>(AutoSubmitControl.selector)

		forms.forEach((form) => this.initializeForm(form))
	}

	private initializeForm(form: HTMLFormElement): void {
		const submit = form.querySelector<HTMLElement>(`${AutoSubmitControl.selector}__submit`)
		const timeout = form.dataset.autosubmitTimeout ? parseInt(form.dataset.autosubmitTimeout) : 200
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

	private handleChange(target: HTMLElement, submit: HTMLElement | null, form: HTMLFormElement): void {
		if (isDatasetTruthy(target, 'autoSubmitDisabled')) {
			return
		}

		if (submit) {
			submit.click()
		} else {
			naja.uiHandler.submitForm(form)
		}
	}
}

export default new AutoSubmitControl()
