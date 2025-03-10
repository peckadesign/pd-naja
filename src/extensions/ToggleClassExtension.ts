import { InteractionEvent } from 'naja/dist/core/UIHandler'
import { CompleteEvent, Extension, Naja, StartEvent } from 'naja/dist/Naja'

type ToggleClassRecord = Record<string, string>

type ToggleClassOptions = {
	element: HTMLElement
	toggleClass: ToggleClassRecord
}

declare module 'naja/dist/Naja' {
	interface Options {
		toggleClassOptions?: ToggleClassOptions
	}
}

export class ToggleClassExtension implements Extension {
	private static selfSelector = ':self'
	private static parentSelector = ':parent'

	public initialize(naja: Naja) {
		naja.uiHandler.addEventListener('interaction', this.checkExtensionEnabled.bind(this))
		naja.addEventListener('start', this.start.bind(this))
		naja.addEventListener('complete', this.complete.bind(this))
	}

	private checkExtensionEnabled(event: InteractionEvent): void {
		const { element, options } = event.detail
		const toggleClass = JSON.parse(element.getAttribute('data-naja-toggle-class') || String(null))

		if (toggleClass) {
			options.toggleClassOptions = {
				element: element as HTMLElement,
				toggleClass
			}
		}
	}

	private start(event: StartEvent): void {
		const { options } = event.detail

		if (options.toggleClassOptions) {
			this.applyToggleClass(options.toggleClassOptions)
		}
	}

	private complete(event: CompleteEvent): void {
		const { error, options } = event.detail

		if (error && options.toggleClassOptions) {
			this.applyToggleClass(options.toggleClassOptions)
		}
	}

	private applyToggleClass(toggleClassOptions: ToggleClassOptions): void {
		for (const [selector, classNames] of Object.entries(toggleClassOptions.toggleClass)) {
			const targets = this.getTargetElements(toggleClassOptions.element, selector)

			targets.forEach((target) => {
				classNames.split(' ').forEach((className) => target.classList.toggle(className))
			})
		}
	}

	private getTargetElements(element: HTMLElement, selector: string): HTMLElement[] {
		const elements: HTMLElement[] = []

		selector.split(',').forEach((singleSelector) => {
			elements.push(...this.getTargetElementsSingleSelector(element, singleSelector.trim()))
		})

		return elements
	}

	private getTargetElementsSingleSelector(element: HTMLElement, selector: string): HTMLElement[] {
		let baseElement: Element = element

		if (selector === ToggleClassExtension.selfSelector) {
			return [element]
		}

		while (selector.startsWith(ToggleClassExtension.parentSelector) && baseElement.parentElement) {
			baseElement = baseElement.parentElement
			selector = selector.slice(ToggleClassExtension.parentSelector.length + 1)
		}

		return Array.from(baseElement.querySelectorAll(selector))
	}
}
