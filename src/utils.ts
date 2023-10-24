export const isDatasetTruthy = (element: Element, datasetName: string): boolean => {
	const datasetValue = (element as HTMLElement).dataset[datasetName]

	return datasetValue !== undefined && datasetValue !== 'false'
}
