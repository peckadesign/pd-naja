import ControlManager from './utils/ControlManager'

export { AjaxModalExtension } from './extensions/AjaxModalExtension'
export { AjaxModalPreventRedrawExtension } from './extensions/AjaxModalPreventRedrawExtension'
export { AjaxOnceExtension } from './extensions/AjaxOnceExtension'
export { ConfirmExtension } from './extensions/ConfirmExtension'
export { FollowUpRequestExtension } from './extensions/FollowUpRequestExtension'
export { ForceRedirectExtension } from './extensions/ForceRedirectExtension'
export { ForceReplaceExtension } from './extensions/ForceReplaceExtension'
export { SnippetFormPartExtension } from './extensions/SnippetFormPartExtension'
export { SpinnerExtension } from './extensions/SpinnerExtension'

export const controlManager = new ControlManager()
