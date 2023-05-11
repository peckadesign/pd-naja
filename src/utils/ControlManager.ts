import naja from 'naja'
import { AfterUpdateEvent } from 'naja/dist/core/SnippetHandler'
import Control from './Control'

let instance: ControlManager | null = null

export default class ControlManager {
	private onLoadControl: Control[] = []
	private onLiveControl: Control[] = []

	public constructor() {
		if (instance === null) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			instance = this
			naja.snippetHandler.addEventListener('afterUpdate', this.onSnippetUpdate.bind(this))
		}
		return instance
	}

	public onLoad(): void {
		this.initialize(this.onLoadControl)
		this.initialize(this.onLiveControl)
	}

	private onSnippetUpdate(event: AfterUpdateEvent): void {
		this.initialize(this.onLiveControl, event.detail.snippet)
	}

	private initialize(controls: Control[], snippet?: Element | Document): void {
		controls.forEach((control) => {
			control.initialize(snippet || document)
		})
	}

	public addControlOnLoad(control: Control): void {
		this.onLoadControl.push(control)
	}

	public addControlOnLive(control: Control): void {
		this.onLiveControl.push(control)
	}
}
