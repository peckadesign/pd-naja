import { SpinnerExtension } from '../extensions/SpinnerExtension'
import { SpinnerPropsFn, SpinnerType, WithSpinner } from '../types'
import { hideSpinner, showSpinner } from '../utils'

export type SuggestOptions = {
	minLength: number
	minLengthForShow: number
	timeout: number
	emptyOnNewQuery: boolean
	showSpinner: boolean
}

export class Suggest {
	public readonly spinnerExtension?: SpinnerExtension
	public readonly spinner?: SpinnerType
	public readonly getSpinnerProps?: SpinnerPropsFn

	public static readonly className = 'js-suggest'
	public static readonly formClassName = `${Suggest.className}__form`
	public static readonly inputClassName = `${Suggest.className}__input`
	public static readonly buttonClassName = `${Suggest.className}__btn`
	public static readonly suggestClassName = `${Suggest.className}__suggest`
	public static readonly linkClassName = `${Suggest.className}__link`

	public readonly element: HTMLElement
	public readonly form: HTMLFormElement
	public readonly input: HTMLInputElement
	public readonly button: HTMLButtonElement
	public readonly suggest: HTMLElement

	private suggestSpinner: Element | undefined

	private isOpen: boolean = false
	private timer: ReturnType<typeof setTimeout> | undefined = undefined

	private lastSearched: string = ''

	private readonly options: SuggestOptions = {
		minLength: 2,
		minLengthForShow: 2,
		timeout: 200,
		emptyOnNewQuery: true,
		showSpinner: true
	}

	public constructor(
		element: HTMLElement,
		form: HTMLFormElement,
		options: Partial<SuggestOptions> = {},
		spinnerExtension: SpinnerExtension | undefined = undefined,
		spinner: SpinnerType | undefined = undefined,
		getSpinnerProps: SpinnerPropsFn = undefined
	) {
		this.element = element
		this.spinnerExtension = spinnerExtension
		this.spinner = spinner || spinnerExtension?.spinner
		this.getSpinnerProps = getSpinnerProps || spinnerExtension?.getSpinnerProps

		const input = element.querySelector<HTMLInputElement>(`.${Suggest.inputClassName}`)
		const button = element.querySelector<HTMLButtonElement>(`.${Suggest.buttonClassName}`)
		const suggest = element.querySelector<HTMLElement>(`.${Suggest.suggestClassName}`)

		if (!input || !button || !suggest) {
			throw new Error('Suggest: Missing form, input, button or suggest element.')
		}

		this.form = form
		this.input = input
		this.button = button
		this.suggest = suggest

		this.options = { ...this.options, ...options }

		this.input.autocomplete = 'off'
		this.input.addEventListener('focus', this.showSuggest.bind(this))
		this.input.addEventListener('blur', this.hideSuggest.bind(this))

		this.input.addEventListener('keydown', this.handleInputKeydown.bind(this))
		this.input.addEventListener('keyup', this.handleInputKeyup.bind(this))

		this.suggest.addEventListener('mousedown', this.handleSuggestMousedown.bind(this))
		// Use the underscore to allow the `element` to be a `form` element. Without the underscore, there would be
		// a failure to set a named property error.
		this.form._suggest = this
	}

	private isEmpty(): boolean {
		return this.suggest.childElementCount === 0
	}

	private showSuggest(): void {
		if (this.isEmpty() || this.input.value.length < this.options.minLengthForShow) {
			return
		}

		const event = new CustomEvent('show.suggest', { bubbles: true, cancelable: true })
		this.suggest.dispatchEvent(event)

		if (event.defaultPrevented) {
			return
		}

		this.isOpen = true
		this.suggest.classList.add(`${Suggest.suggestClassName}--shown`)
	}

	private hideSuggest(): void {
		const event = new CustomEvent('hide.suggest', { bubbles: true, cancelable: true })
		this.suggest.dispatchEvent(event)

		if (event.defaultPrevented) {
			return
		}

		const activeClassName = `${Suggest.linkClassName}--active`
		const activeAnchor: HTMLAnchorElement | null | undefined = this.suggest.querySelector<HTMLAnchorElement>(
			`.${activeClassName}`
		)

		activeAnchor?.classList.remove(activeClassName)

		this.isOpen = false
		this.suggest.classList.remove(`${Suggest.suggestClassName}--shown`)
	}

	private emptySuggest(): void {
		this.suggest.classList.add(`${Suggest.suggestClassName}--empty`)
		this.suggest.replaceChildren()
	}

	public startSuggest(): void {
		this.suggest.dispatchEvent(new CustomEvent('loading.suggest', { bubbles: true }))
		this.input.classList.add(`${Suggest.inputClassName}--loading`)

		if (this.options.showSpinner && this.spinner && !this.suggestSpinner) {
			const targets = this.spinnerExtension?.getTargetsByDOM(this.button)
			const target = targets && targets.length ? targets[0] : this.form

			this.suggestSpinner = showSpinner.call(this as WithSpinner, target)
		}
	}

	public finishSuggest(): void {
		this.suggest.dispatchEvent(new CustomEvent('loaded.suggest', { bubbles: true }))
		this.input.classList.remove(`${Suggest.inputClassName}--loading`)

		this.suggest.classList.toggle(`${Suggest.suggestClassName}--empty`, this.isEmpty())

		if (this.isEmpty() || document.activeElement !== this.input) {
			this.hideSuggest()
		} else {
			this.showSuggest()
		}

		if (this.suggestSpinner) {
			hideSpinner(this.suggestSpinner)
			this.suggestSpinner = undefined
		}
	}

	private handleInputKeydown(event: KeyboardEvent): void {
		const activeClassName = `${Suggest.linkClassName}--active`
		let anchors: HTMLAnchorElement[]
		let activeAnchor: HTMLAnchorElement | null | undefined
		let activeAnchorIndex: number | undefined

		switch (event.key) {
			case 'Escape':
				event.preventDefault()

				this.hideSuggest()
				this.input.blur()

				break

			case 'ArrowDown':
			case 'ArrowUp':
				event.preventDefault()

				anchors = Array.from(this.suggest.querySelectorAll<HTMLAnchorElement>(`.${Suggest.linkClassName}`))
				activeAnchor = anchors.find((element) => element.classList.contains(activeClassName))
				activeAnchorIndex = activeAnchor ? anchors.indexOf(activeAnchor) : undefined

				activeAnchor?.classList.remove(activeClassName)

				if (event.key === 'ArrowDown') {
					activeAnchorIndex = activeAnchorIndex !== undefined ? activeAnchorIndex + 1 : 0
				} else {
					activeAnchorIndex = activeAnchorIndex !== undefined ? activeAnchorIndex - 1 : anchors.length - 1
				}

				anchors[activeAnchorIndex]?.classList.add(activeClassName)
				anchors[activeAnchorIndex]?.scrollIntoView({
					block: 'nearest'
				})

				break

			case 'Enter':
				activeAnchor = this.suggest.querySelector<HTMLAnchorElement>(`.${activeClassName}`)

				if (activeAnchor) {
					event.preventDefault()
					event.stopPropagation()

					activeAnchor.click()
				}
				break
		}
	}

	private handleInputKeyup(): void {
		clearTimeout(this.timer)

		const query = this.input.value

		if (query.length < this.options.minLengthForShow) {
			this.hideSuggest()
			return
		}

		if (!this.isOpen) {
			// If the suggestion wasn't open and this query is different from the last query, we need to clear the
			// results because they are not relevant. This only needs to be done if the suggestion has been closed.
			if (query !== this.lastSearched && this.options.emptyOnNewQuery) {
				this.emptySuggest()
			}

			this.showSuggest()
		}

		// If the query is the same or not long enough, there's nothing more to do.
		if (query === this.lastSearched || query.length < this.options.minLength) {
			return
		}

		this.timer = setTimeout(() => {
			this.lastSearched = query
			this.button.click()
		}, this.options.timeout)
	}

	private handleSuggestMousedown(event: MouseEvent): void {
		event.preventDefault()

		const target = event.target as HTMLElement
		if (target.dataset.suggestClose || target.closest('[data-suggest-close]')) {
			this.input.blur()
		}
	}
}
