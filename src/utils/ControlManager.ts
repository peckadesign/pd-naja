import naja from 'naja'
import { AfterUpdateEvent, BeforeUpdateEvent } from 'naja/dist/core/SnippetHandler'
import Control from './Control'

let instance: ControlManager | null = null

export default class ControlManager {
	private onLoadControl: Control[] = []
	private onLiveControl: Control[] = []

	public constructor() {
		if (instance === null) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			instance = this
			naja.snippetHandler.addEventListener('beforeUpdate', this.onBeforeSnippetUpdate.bind(this))
			naja.snippetHandler.addEventListener('afterUpdate', this.onSnippetUpdate.bind(this))
		}
		return instance
	}

	public onLoad(): void {
		this.initialize(this.onLoadControl)
		this.initialize(this.onLiveControl)
	}

	private onBeforeSnippetUpdate(event: BeforeUpdateEvent): void {
		if (
			event.detail.operation === naja.snippetHandler.op.append ||
			event.detail.operation === naja.snippetHandler.op.prepend
		) {
			return
		}

		this.destroy(this.onLiveControl, event.detail.snippet)
	}

	private onSnippetUpdate(event: AfterUpdateEvent): void {
		this.initialize(this.onLiveControl, event.detail.snippet)
	}

	private initialize(controls: Control[], snippet?: Element | Document): void {
		controls.forEach((control) => {
			control.initialize(snippet || document)
		})
	}

	private destroy(controls: Control[], snippet: Element): void {
		controls.forEach((control) => {
			if (control.destroy !== undefined) {
				control.destroy(snippet)
			}
		})
	}

	public addControlOnLoad(control: Control): void {
		this.onLoadControl.push(control)
	}

	public addControlOnLive(control: Control): void {
		this.onLiveControl.push(control)
	}
}
