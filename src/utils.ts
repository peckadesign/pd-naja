import { WithSpinner } from './types'

export function showSpinner(this: WithSpinner, target: Element, initiator: Element = target): Element {
	let spinner: Element

	if (typeof this.spinner === 'function') {
		spinner = this.getSpinnerProps ? this.spinner(this.getSpinnerProps(initiator)) : this.spinner()
	} else {
		spinner = this.spinner
	}

	target.appendChild(spinner)
	spinner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100 })

	return spinner
}

export function hideSpinner(spinner: Element): void {
	const animation = spinner.animate({ opacity: 0 }, { duration: 100 })
	animation.finished.then(() => spinner?.remove())
}

export const isDatasetTruthy = (element: Element, datasetName: string): boolean => {
	const datasetValue = (element as HTMLElement).dataset[datasetName]

	return datasetValue !== undefined && datasetValue !== 'false' && datasetValue !== 'off'
}

export const isDatasetFalsy = (element: Element, datasetName: string): boolean => {
	const datasetValue = (element as HTMLElement).dataset[datasetName]

	return datasetValue === 'off' || datasetValue === 'false'
}
