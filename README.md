# pd-naja

1. [Quick start](#quick-start)
2. [Utilities](#utilities)
3. [Extensions](#extensions)
   1. [AjaxModalExtension](#ajaxmodalextension)
   2. [SpinnerExtension](#spinnerextension)

## Quick start
```
$ npm install naja @peckadesign/pd-naja
```

```typescript
import naja from 'naja'
import { ExtensionName } from '@peckadesign/pd-naja'

naja.registerExtension(new ExtensionName())
```

```typescript
import { controlManager } from '@peckadesign/pd-naja'
import SomeControl from '@/js/Controls/SomeControl' // `SomeControl` must implement `Control` interface
import SomeAnotherControl from '@/js/Controls/SomeAnotherControl'

// This control is only initialized on page load
controlManager.addControlOnLoad(SomeControl)

// This control will also get initialized after Naja requests
controlManager.addControlOnLive(SomeAnotherControl)

```

## Utilities
This package provides easy ways to add JS components reactive to Naja ajax events.

`Control` is meant to be used for standalone components, that might be dependent on ajax. It should be used together with `ControlManager`. Class implementing the `Control` interface **should export its instance**. Then the intended lifecycle of class is as follows:

1. `constructor` is called immediately and is also called only once. This is the ideal place for e.g. adding common event handlers to the `body`, or modifying necessary DOM properties on elements not affected by ajax.

2. The instantiated class is then added to ControlManager either by `addControlOnLoad` or `addControlOnLive`. This ensures, that on `DOMContentLoaded` the `initialize` function of class is called. This method should implement initialization of the control dependent on fully loaded DOM. The `context` argument is equal to `document` in this call.

3. In the case of using `addControlOnLive`, two methods are called after each successful Ajax request:
   1. **Optional:** Just before the snippet update, the optional `destroy` method is called. It will only be called if the [snippet update operation](https://naja.js.org/#/snippets?id=snippet-update-operation) is `replace`.

   2. The `initialize` method is called for each snippet. It is called immediately after the snippet has been updated. The `context` argument is equal to the modified nette snippet.


## Extensions

### `AjaxModalExtension`
This extension allows you to implement modal window with browser history using Naja. Extension itself is agnostic of used modal, you can use any modal plugin you want as long as you provide simple adapter implementing `AjaxModal` interface. Class implementing `AjaxModal` is only parameter recieved by constructor.

```typescript
import naja from 'naja'
import { AjaxModalExtension } from '@peckadesign/pd-naja'
import { modal } from '@/js/App/PdModal' // modal must implement AjaxModal interface 

naja.registerExtension(
	new AjaxModalExtension(modal)
)
```

#### Interface `AjaxModal`
| Property                                                                                                                                      | Description                                                                                                                                                                                                                                                                                                                                            |
|-----------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `element: Element`                                                                                                                            | Most outer element of the modal window.                                                                                                                                                                                                                                                                                                                |
| `reservedSnippetIds: string[]`                                                                                                                | List of snippet id's, that are neccessary for modal to work, e.g. `snippet--modal`.                                                                                                                                                                                                                                                                    |
| `show(opener: Element \| undefined, options: any, event: BeforeEvent \| PopStateEvent): void`                                                 | Method that is called for opening the modal. `opener` is the element causing the opening, event is the associated event.                                                                                                                                                                                                                               |
| `hide(event: SuccessEvent \| PopStateEvent): void`                                                                                            | Method that is called for closing the modal either as a result of `closeModal` property in ajax response or as a result of navigating using browser history.                                                                                                                                                                                           |                                            
| `isShown(): boolean`                                                                                                                          | Should return wheter the modal is opened or not.                                                                                                                                                                                                                                                                                                       |
| `onShow: (callback: EventListener) => void`<br/>`onHide: (callback: EventListener) => void`<br/>`onHidden: (callback: EventListener) => void` | The extension needs to attach some handlers when show, hide or hidden happens. These functions should provide a way to add listeners to such events.                                                                                                                                                                                                   |
| `dispatchLoad?: (options: any, event: SuccessEvent \| PopStateEvent) => void`                                                                 | If you provide this method, extension will call it whenever the content is changed (loaded).                                                                                                                                                                                                                                                           |
| `getOptions(opener: Element): any`                                                                                                            | If you need to change some modal settings based on opener element, you can do that in this function. Return value of this function is stored in `localStorage` (or wherever is Naja configured to store states) and also in `HistoryState`. Bear in mind that this introduces some limitations of what can be returned (e.g. no `Element` is allowed). | 
| `setOptions(options: any): void`                                                                                                              | Counterpart of `getOptions` method, you can use this method to restore modal settings based on `options`.                                                                                                                                                                                                                                              |

### `AjaxModalPreventRedrawExtension`
Occasionally we may have an ajax request invoked inside the modal window, but this request is not related to the modal window itself. However, because it is invoked from within the modal window, the HTTP header `Pd-Modal-Opened` is set. If enabled, this extension adds another header to the request, namely `Pd-Modal-Prevent-Redraw`. The extension can be enabled by adding the `data-naja-modal-prevent-redraw` data attribute to the interacted element, or by adding `pdModalPreventRedraw` to options.


### `AjaxOnceExtension`
This extension allows you to specify for a given element that the request will only be made on the first interaction. For example, for collapsible boxes, it is possible to make the request only once, when they are expanded for the first time. It is enabled by setting `data-naja-once` on the interacted element and allows the same element to control the collapsible box and make a request at the same time, without creating multiple unnecessary requests.

### `ConfirmExtension`
Simple extension that uses `window.confirm` before making the request, allowing the user to prevent the request from being made. It is enabled by setting the data attribute `data-confirm`. The value of the attribute is used as a parameter for the `window.confirm` call.

### `FollowUpRequestExtension`
This extension allows you to chain multiple requests. This is useful, for example, within modals, where after redrawing the modal, you may need to redraw the page below it as well. This page may be from a different presenter, so you need to redraw with a different request. When used, this extension checks for the presence of `followUpUrl` in the payload. This is the URL to which the follow up request will be made.

### `ForceRedirectExtension`
This extension allows you to force redirect the page to a specific URL. When imported, it checks for the presence of `forceRedirect` in the payload and then redirects to it. 

### `ForceReplaceExtension`
If you are using content prepending or appending on snippets, you may need to force replace their content when certain elements have been interacted with. For example, if you have an infinite pager with new items appended, you may need to clear the snippet when some sort of filtering request has been made. This extension changes the snippet operation to `replace` when enabled by using the `data-naja-snippet-force-replace attribute` on the interacted element. See [Snippet update operation](https://naja.js.org/#/snippets?id=snippet-update-operation) in the Naja docs for more information about update operations.

### `SpinnerExtension`

This extension allows you to add configurable loading indicator to ajax request. Constructor recieves following 4 parameters:

| Parameter                                                                | Description                                                                                                                                                             |
|--------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `spinner: ((props?: any) => Element) \| Element`                         | Mandatory parameter. It should either be function return the spinner element, or directly element.                                                                      |
| `getSpinnerProps: ((initator: Element) => any) \| undefined = undefined` | If you provide `spinner` as a function, you might also provide function to get settings from ajax initiator. Returned value is passed as a `props` to `spinner()` call. |
| `ajaxSpinnerWrapSelector = '.ajax-wrap'`  | See below.                                                                                                                                                              |
|`ajaxSpinnerPlaceholderSelector = '.ajax-spinner'`| See below                                                                                                                                                               |

The logic for spinner placeholder is as follows:
1. Extension can be turned off by using `data-naja-spinner="off"`.
2. If there is `data-naja-spinner` with different value, this value is used as a selector for element into which the spinner element is appended.
3. If there is no `data-naja-spinner`, closest `ajaxSpinnerWrapSelector` is being searched for and:
   1. If there is `ajaxSpinnerPlaceholderSelector` inside, this element is used for placing spinner element.
   2. If not, the spinner element is appended into `ajaxSpinnerWrapSelector` itself.
