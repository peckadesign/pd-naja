export const isDatasetTruthy = (element: Element, datasetName: string): boolean => {
	const datasetValue = (element as HTMLElement).dataset[datasetName]

	return datasetValue !== undefined && datasetValue !== 'false' && datasetValue !== 'off'
}

export const isDatasetFalsy = (element: Element, datasetName: string): boolean => {
	const datasetValue = (element as HTMLElement).dataset[datasetName]

	return datasetValue === 'off' || datasetValue === 'false'
}
