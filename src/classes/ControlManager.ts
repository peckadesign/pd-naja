import { AfterUpdateEvent, BeforeUpdateEvent } from 'naja/dist/core/SnippetHandler'
import { Naja } from 'naja/dist/Naja'
import { Control } from '../types'

let instance: ControlManager | null = null

export class ControlManager {
	private naja!: Naja
	private onLoadControl: Control[] = []
	private onLiveControl: Control[] = []

	public constructor(naja: Naja) {
		if (instance === null) {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			instance = this
			this.naja = naja
			this.naja.snippetHandler.addEventListener('beforeUpdate', this.onBeforeSnippetUpdate.bind(this))
			this.naja.snippetHandler.addEventListener('afterUpdate', this.onSnippetUpdate.bind(this))
		}
		return instance
	}

	public onLoad(): void {
		this.initialize(this.onLoadControl)
		this.initialize(this.onLiveControl)
	}

	private onBeforeSnippetUpdate(event: BeforeUpdateEvent): void {
		if (
			event.detail.operation === this.naja.snippetHandler.op.append ||
			event.detail.operation === this.naja.snippetHandler.op.prepend
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
