// `Control` is meant to be used for standalone components, that might be dependent on ajax. It should be used together
// with ControlManager. Class implementing the `Control` interface should export its instance. Then the intended
// lifecycle of class is as follows:
//
// 1. `constructor` is called immediately and is also called only once. This is the ideal place for e.g. adding common
//    event handlers to the `body`, or modifying necessary DOM properties on elements not affected by ajax.

// 2. The instantiated class is then added to ControlManager either by `addControlOnLoad` or `addControlOnLive`. This
//    ensures, that on `DOMContentLoaded` the `initialize` function of class is called. This method should implement
//    initialization of the control dependent on fully loaded DOM. The `context` argument is equal to `document` in this
//    call.
//
// 3. In case of `addControlOnLive` used, the `initialize` method is also called for each success ajax request. The
//    `context` argument is equal to modified nette snippet.
//
// There is also optional method `destroy`. This method is called for each snippet before its content is being replaced.
// It is only called on snippets where operation is equal to naja.snippetHandler.
export default interface Control {
	initialize(context: Element | Document): void

	destroy?(context: Element): void
}
