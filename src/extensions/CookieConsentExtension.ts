import A11yDialog from 'a11y-dialog'
import { Extension, InteractionEvent, Naja, SuccessEvent } from 'naja'

declare module 'naja' {
	interface Options {
		isCookieConsentRequest?: boolean
	}
}

export class CookieConsentExtension implements Extension {
	private element: HTMLElement | null
	private form: HTMLFormElement | null
	private a11yDialog: A11yDialog | undefined
	private static readonly selector = '.js-cookie-consent'

	public constructor() {
		this.element = document.querySelector<HTMLElement>(CookieConsentExtension.selector)
		this.form = this.element?.querySelector<HTMLFormElement>(`${CookieConsentExtension.selector}__form`) || null

		if (!this.element || !this.form) {
			return
		}

		this.a11yDialog = new A11yDialog(this.element)
		this.a11yDialog.show()
	}

	public initialize(naja: Naja): void {
		if (this.form === null) {
			return
		}

		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))
		naja.addEventListener('success', this.handleSuccess.bind(this))
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element, options } = event.detail
		const inputElement = element as HTMLInputElement

		options.isCookieConsentRequest = inputElement.form !== null && inputElement.form === this.form
	}

	private handleSuccess(event: SuccessEvent): void {
		const { options } = event.detail

		if (!options.isCookieConsentRequest || !this.form) {
			return
		}

		const consentCategories = this.getAcceptedCategories(this.form)

		if (consentCategories.length) {
			const scripts = this.getScripts(consentCategories)
			this.runScripts(scripts)
		}

		this.closeCookieConsent()
	}

	private getAcceptedCategories(form: HTMLFormElement): string[] {
		const categories: string[] = []
		const submittedBy = (form as unknown as { 'nette-submittedBy'?: HTMLElement })['nette-submittedBy']
		const acceptAll: boolean = submittedBy !== undefined && submittedBy.dataset.cookieConsentAcceptAll !== undefined
		const rejectAll: boolean = submittedBy !== undefined && submittedBy.dataset.cookieConsentRejectAll !== undefined

		if (rejectAll) {
			return []
		}

		for (let i = 0; i < form.elements.length; i++) {
			const input = form.elements[i] as HTMLInputElement
			const consent = input.dataset.cookieConsentCategory

			if (consent && (acceptAll || input.checked)) {
				categories.push(consent)
			}
		}

		return categories
	}

	private getScripts(categories: string[]): NodeListOf<HTMLScriptElement> {
		const selectors: string[] = []

		categories.forEach((category) => {
			selectors.push(`script[data-cookie-consent="${category}"]`)
		})

		return document.querySelectorAll<HTMLScriptElement>(selectors.join(','))
	}

	private runScripts(scripts: NodeListOf<HTMLScriptElement>): void {
		scripts.forEach((script) => this.runScript(script))
	}

	private runScript(script: HTMLScriptElement): void {
		const scriptRunnable = document.createElement('script')

		if (script.src) {
			scriptRunnable.src = script.src
		} else {
			scriptRunnable.innerHTML = script.innerHTML
		}

		scriptRunnable.async = script.async
		scriptRunnable.defer = script.defer

		scriptRunnable.crossOrigin = script.crossOrigin
		scriptRunnable.referrerPolicy = script.referrerPolicy

		script.insertAdjacentElement('afterend', scriptRunnable)
		script.remove()
	}

	private closeCookieConsent(): void {
		if (!this.element) {
			return
		}

		document.dispatchEvent(new CustomEvent('cookieConsentBeforeClose', { bubbles: true }))

		const closingDuration = parseInt(
			getComputedStyle(this.element).getPropertyValue('--pd-modal-closing-duration') || '0'
		)

		this.element.dataset.modalClosing = 'true'

		setTimeout(() => {
			this.element?.remove()
			document.dispatchEvent(new CustomEvent('cookieConsentAfterClose', { bubbles: true }))
		}, closingDuration)
	}
}
