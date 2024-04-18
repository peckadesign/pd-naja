import { SpinnerExtension } from '../extensions/SpinnerExtension'
import { SpinnerPropsFn, SpinnerType, WithSpinner } from '../types'
import { hideSpinner, showSpinner } from '../utils'

export type SuggestOptions = {
	minLength: number
	timeout: number
	emptyOnNewQuery: boolean
	showSpinner: boolean
}

export class Suggest {
	public readonly spinnerExtension?: SpinnerExtension
	public readonly spinner?: SpinnerType
	public readonly getSpinnerProps?: SpinnerPropsFn

	public static readonly className = 'js-suggest'
	public readonly inputClassName = `${Suggest.className}__input`
	public readonly buttonClassName = `${Suggest.className}__btn`
	public readonly suggestClassName = `${Suggest.className}__suggest`
	public readonly linkClassName = `${Suggest.className}__link`

	private readonly form: HTMLFormElement
	private readonly input: HTMLInputElement
	private readonly button: HTMLButtonElement
	private readonly suggest: HTMLElement

	private suggestSpinner: Element | undefined

	private isOpen: boolean = false
	private timer: ReturnType<typeof setTimeout> | undefined = undefined

	private lastSearched: string = ''

	private readonly options: SuggestOptions = {
		minLength: 2,
		timeout: 200,
		emptyOnNewQuery: true,
		showSpinner: true
	}

	public constructor(
		form: HTMLFormElement,
		options: Partial<SuggestOptions> = {},
		spinnerExtension: SpinnerExtension | undefined = undefined,
		spinner: SpinnerType | undefined = undefined,
		getSpinnerProps: SpinnerPropsFn = undefined
	) {
		this.form = form
		this.spinnerExtension = spinnerExtension
		this.spinner = spinner || spinnerExtension?.spinner
		this.getSpinnerProps = getSpinnerProps || spinnerExtension?.getSpinnerProps

		const input = form.querySelector<HTMLInputElement>(`.${this.inputClassName}`)
		const button = form.querySelector<HTMLButtonElement>(`.${this.buttonClassName}`)
		const suggest = form.querySelector<HTMLElement>(`.${this.suggestClassName}`)

		if (!input || !button || !suggest) {
			throw new Error('Suggest: Missing input, button or suggest element.')
		}

		this.input = input
		this.button = button
		this.suggest = suggest

		this.options = { ...this.options, ...options }

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
		if (this.isEmpty() || this.input.value.length < this.options.minLength) {
			return
		}

		const event = new CustomEvent('show.suggest', { bubbles: true, cancelable: true })
		this.suggest.dispatchEvent(event)

		if (event.defaultPrevented) {
			return
		}

		this.isOpen = true
		this.suggest.classList.add(`${this.suggestClassName}--shown`)
	}

	private hideSuggest(): void {
		const event = new CustomEvent('hide.suggest', { bubbles: true, cancelable: true })
		this.suggest.dispatchEvent(event)

		if (event.defaultPrevented) {
			return
		}

		this.isOpen = false
		this.suggest.classList.remove(`${this.suggestClassName}--shown`)
	}

	private emptySuggest(): void {
		this.suggest.classList.add(`${this.suggestClassName}--empty`)
		this.suggest.replaceChildren()
	}

	public startSuggest(): void {
		this.suggest.dispatchEvent(new CustomEvent('loading.suggest', { bubbles: true }))
		this.input.classList.add(`${this.inputClassName}--loading`)

		if (this.options.showSpinner && this.spinner && !this.suggestSpinner) {
			const targets = this.spinnerExtension?.getTargetsByDOM(this.button)
			const target = targets && targets.length ? targets[0] : this.form

			this.suggestSpinner = showSpinner.call(this as WithSpinner, target)
		}
	}

	public finishSuggest(): void {
		this.suggest.dispatchEvent(new CustomEvent('loaded.suggest', { bubbles: true }))
		this.input.classList.remove(`${this.inputClassName}--loading`)

		this.suggest.classList.toggle(`${this.suggestClassName}--empty`, this.isEmpty())

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
		let anchors: HTMLAnchorElement[]
		let activeAnchor: HTMLAnchorElement | null | undefined
		let activeAnchorIndex: number | undefined
		const activeClassName = `${this.linkClassName}--active`

		switch (event.key) {
			case 'Escape':
				event.preventDefault()
				this.hideSuggest()
				this.input.blur()
				break

			case 'ArrowDown':
			case 'ArrowUp':
				event.preventDefault()

				anchors = Array.from(this.suggest.querySelectorAll<HTMLAnchorElement>(`.${this.linkClassName}`))
				activeAnchor = anchors.find((element) => element.classList.contains(activeClassName))
				activeAnchorIndex = activeAnchor ? anchors.indexOf(activeAnchor) : undefined

				activeAnchor?.classList.remove(activeClassName)

				if (event.key === 'ArrowDown') {
					activeAnchorIndex = activeAnchorIndex !== undefined ? activeAnchorIndex + 1 : 0
				} else {
					activeAnchorIndex = activeAnchorIndex !== undefined ? activeAnchorIndex - 1 : anchors.length - 1
				}

				anchors[activeAnchorIndex]?.classList.add(activeClassName)

				break

			case 'Enter':
				activeAnchor = this.suggest.querySelector<HTMLAnchorElement>(`.${activeClassName}`)

				if (activeAnchor) {
					event.preventDefault()
					event.stopPropagation()

					location.href = activeAnchor.href
				}
				break
		}
	}

	private handleInputKeyup(): void {
		clearTimeout(this.timer)

		const query = this.input.value

		if (query.length < this.options.minLength) {
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

		// If the query is the same, there's nothing more to do.
		if (query === this.lastSearched) {
			return
		}

		this.timer = setTimeout(() => {
			this.lastSearched = query
			this.button.click()
		}, this.options.timeout)
	}

	private handleSuggestMousedown(event: MouseEvent): void {
		event.preventDefault()
	}
}
