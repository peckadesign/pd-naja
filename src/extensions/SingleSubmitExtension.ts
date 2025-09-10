import { CompleteEvent, Extension, InteractionEvent, Naja, StartEvent } from 'naja'
import { isDatasetFalsy } from '../utils'

type HTMLSubmitElement = HTMLButtonElement | HTMLInputElement

declare module 'naja' {
	interface Options {
		singleSubmitForm?: HTMLFormElement
	}
}

export class SingleSubmitExtension implements Extension {
	public timeout: number = 60000
	public buttonDisabledClass: string | undefined
	private readonly submitSelector = 'input[type=submit], button[type=submit], input[type=image]'

	public constructor(buttonDisabledClass?: string, timeout: number = 60000) {
		this.buttonDisabledClass = buttonDisabledClass
		this.timeout = timeout

		// Handle non-ajax form submission as well
		document.addEventListener('submit', (event: SubmitEvent) => {
			const form = event.target

			if (!(form instanceof HTMLFormElement) || this.isExtensionDisabled(form)) {
				return true
			}

			this.formSubmitBeforeHandler(form)
			form.dataset.singleSubmitTimeout = String(
				setTimeout(() => {
					this.formSubmitAfterHandler(form)
				}, this.timeout)
			)
		})
	}

	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))

		naja.addEventListener('start', (event: StartEvent) => {
			if (event.detail.options.singleSubmitForm) {
				this.formSubmitBeforeHandler(event.detail.options.singleSubmitForm, true)
			}
		})

		naja.addEventListener('complete', (event: CompleteEvent) => {
			if (event.detail.options.singleSubmitForm) {
				this.formSubmitAfterHandler(event.detail.options.singleSubmitForm)
			}
		})
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element, options } = event.detail

		const inputElement = element as HTMLInputElement

		if (!inputElement.form || this.isExtensionDisabled(inputElement.form)) {
			return
		}

		options.singleSubmitForm = inputElement.form
	}

	private isExtensionDisabled(form: HTMLFormElement): boolean {
		const button = form['nette-submittedBy'] as HTMLSubmitElement | undefined

		return (button && isDatasetFalsy(button, 'najaSingleSubmit')) || isDatasetFalsy(form, 'najaSingleSubmit')
	}

	private preventFormSubmit(event: SubmitEvent): void {
		event.preventDefault()
	}

	private formSubmitBeforeHandler(form: HTMLFormElement, isAjax: boolean = false): void {
		// Non-ajax forms
		clearTimeout(Number(form.dataset.singleSubmitTimeout))
		delete form.dataset.singleSubmitTimeout

		form.addEventListener('submit', this.preventFormSubmit)

		// All forms;
		// Make sure the `disabled` attribute is set after submitting the form. In the case of AJAX forms, the
		// `formData` is constructed during the `makeRequest` function and the `before` event is dispatched afterward,
		// so there is no need to use `setTimeout` in this scenario.
		if (isAjax) {
			this.disableSubmitForm(form)
		} else {
			setTimeout(() => this.disableSubmitForm(form), 0)
		}
	}

	private formSubmitAfterHandler(form: HTMLFormElement): void {
		// Non-ajax forms
		clearTimeout(Number(form.dataset.singleSubmitTimeout))
		delete form.dataset.singleSubmitTimeout

		form.removeEventListener('submit', this.preventFormSubmit)

		// All forms
		this.enableSubmitForm(form)
	}

	private disableSubmitForm(form: HTMLFormElement): void {
		form.querySelectorAll<HTMLSubmitElement>(this.submitSelector).forEach((submit) => {
			this.disableSubmitElement(submit)
		})
	}

	private disableSubmitElement(button: HTMLSubmitElement): void {
		// Handle only non-disabled elements
		if (button.disabled) {
			return
		}

		button.dataset.singleSubmitExtensionDisabled = 'true'
		button.disabled = true

		if (this.buttonDisabledClass) {
			button.classList.add(this.buttonDisabledClass)
		}
	}

	private enableSubmitForm(form: HTMLFormElement): void {
		form.querySelectorAll<HTMLSubmitElement>(this.submitSelector).forEach((submit) => {
			this.enableSubmitElement(submit)
		})
	}

	private enableSubmitElement(button: HTMLSubmitElement): void {
		// Ensures we only process items we have previously disabled
		if (!button.dataset.singleSubmitExtensionDisabled) {
			return
		}

		delete button.dataset.singleSubmitExtensionDisabled
		button.disabled = false

		if (this.buttonDisabledClass) {
			button.classList.remove(this.buttonDisabledClass)
		}
	}
}
