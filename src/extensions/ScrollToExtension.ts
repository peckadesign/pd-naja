import { BeforeEvent, Extension, InteractionEvent, Naja, SuccessEvent } from 'naja'

type NajaScrollToEvent = 'before' | 'success'

declare module 'naja' {
	interface Options {
		scrollToEvent?: NajaScrollToEvent
		scrollToOptions?: ScrollIntoViewOptions
		scrollToSelector?: string
	}
}

export class ScrollToExtension implements Extension {
	public defaultScrollToEvent: NajaScrollToEvent = 'before'

	public constructor(defaultScrollToEvent?: NajaScrollToEvent) {
		if (defaultScrollToEvent) {
			this.defaultScrollToEvent = defaultScrollToEvent
		}
	}

	public initialize(naja: Naja): void {
		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))
		naja.addEventListener('before', this.checkScroll.bind(this))
		naja.addEventListener('success', this.checkScroll.bind(this))
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element, options } = event.detail
		const selector = element.getAttribute('data-naja-scroll-to')

		if (selector) {
			const event = element.getAttribute('data-naja-scroll-to-event') as NajaScrollToEvent | undefined
			const scrollOptions = element.getAttribute('data-naja-scroll-to-options')

			options.scrollToSelector = selector
			options.scrollToOptions = scrollOptions ? JSON.parse(scrollOptions) : undefined
			options.scrollToEvent = event ?? this.defaultScrollToEvent
		}
	}

	private checkScroll(event: BeforeEvent | SuccessEvent): void {
		const { options } = event.detail

		if (options.scrollToSelector && event.type === options.scrollToEvent) {
			const scrollToElement = document.querySelector<HTMLElement>(options.scrollToSelector)
			scrollToElement?.scrollIntoView(options.scrollToOptions)
		}
	}
}
