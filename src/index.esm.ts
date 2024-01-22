import ControlManager from './utils/ControlManager'

export { AjaxModalExtension } from './extensions/AjaxModalExtension'
export { AjaxModalPreventRedrawExtension } from './extensions/AjaxModalPreventRedrawExtension'
export { AjaxOnceExtension } from './extensions/AjaxOnceExtension'
export { BtnSpinnerExtension } from './extensions/BtnSpinnerExtension'
export { ConfirmExtension } from './extensions/ConfirmExtension'
export { FollowUpRequestExtension } from './extensions/FollowUpRequestExtension'
export { ForceRedirectExtension } from './extensions/ForceRedirectExtension'
export { ForceReplaceExtension } from './extensions/ForceReplaceExtension'
export { ScrollToExtension } from './extensions/ScrollToExtension'
export { SingleSubmitExtension } from './extensions/SingleSubmitExtension'
export { SnippetFormPartExtension } from './extensions/SnippetFormPartExtension'
export { SpinnerExtension } from './extensions/SpinnerExtension'
export { ToggleClassExtension } from './extensions/ToggleClassExtension'

export { isDatasetTruthy, isDatasetFalsy } from './utils'

export const controlManager = new ControlManager()
