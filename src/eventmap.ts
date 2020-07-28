
/**
 * A more global and permissive event map made to create helpers for setting up elements
 */
export interface AllEventMap<ET extends EventTarget = HTMLElement> {
  "MSCandidateWindowHide": Event
  "MSCandidateWindowShow": Event
  "MSCandidateWindowUpdate": Event
  "MSGestureChange": Event
  "MSGestureDoubleTap": Event
  "MSGestureEnd": Event
  "MSGestureHold": Event
  "MSGestureStart": Event
  "MSGestureTap": Event
  "MSInertiaStart": Event
  "MSPointerCancel": Event
  "MSPointerDown": Event
  "MSPointerEnter": Event
  "MSPointerLeave": Event
  "MSPointerMove": Event
  "MSPointerOut": Event
  "MSPointerOver": Event
  "MSPointerUp": Event
  "SVGUnload": Event
  "SVGZoom": SVGZoomEvent
  "abort": ET extends FileReader ? ProgressEvent<FileReader> : ET extends Window ? UIEvent : ET extends XMLHttpRequestEventTarget ? ProgressEvent<XMLHttpRequestEventTarget> : Event
  "addsourcebuffer": Event
  "addtrack": Event
  "afterprint": Event
  "audioend": Event
  "audioprocess": AudioProcessingEvent
  "audiostart": Event
  "beforeprint": Event
  "beforeunload": BeforeUnloadEvent
  "blocked": Event
  "blur": FocusEvent
  "bounce": Event
  "boundary": SpeechSynthesisEvent
  "bufferedamountlow": Event
  "cached": Event
  "cancel": AnimationPlaybackEvent
  "canplay": Event
  "canplaythrough": Event
  "change": MediaQueryListEvent
  "checking": Event
  "click": MouseEvent
  "close": CloseEvent
  "compassneedscalibration": Event
  "complete": OfflineAudioCompletionEvent
  "connectionstatechange": Event
  "contextmenu": MouseEvent
  "controllerchange": Event
  "cuechange": Event
  "datachannel": RTCDataChannelEvent
  "dblclick": MouseEvent
  "devicechange": Event
  "devicelight": DeviceLightEvent
  "devicemotion": DeviceMotionEvent
  "deviceorientation": DeviceOrientationEvent
  "deviceorientationabsolute": DeviceOrientationEvent
  "downloading": Event
  "drag": DragEvent
  "dragend": DragEvent
  "dragenter": DragEvent
  "dragleave": DragEvent
  "dragover": DragEvent
  "dragstart": DragEvent
  "drop": DragEvent
  "durationchange": Event
  "emptied": Event
  "encrypted": MediaEncryptedEvent
  "end": SpeechSynthesisEvent
  "ended": Event
  "enter": Event
  "error": ET extends AbstractWorker ? ErrorEvent : ET extends FileReader ? ProgressEvent<FileReader> : ET extends RTCDataChannel ? RTCErrorEvent : ET extends RTCDtlsTransport ? RTCErrorEvent : ET extends SpeechSynthesisUtterance ? SpeechSynthesisErrorEvent : ET extends Window ? ErrorEvent : ET extends XMLHttpRequestEventTarget ? ProgressEvent<XMLHttpRequestEventTarget> : Event
  "exit": Event
  "finish": AnimationPlaybackEvent
  "focus": FocusEvent
  "fullscreenchange": Event
  "fullscreenerror": Event
  "gatheringstatechange": Event
  "hashchange": HashChangeEvent
  "icecandidate": RTCPeerConnectionIceEvent
  "icecandidateerror": RTCPeerConnectionIceErrorEvent
  "iceconnectionstatechange": Event
  "icegatheringstatechange": Event
  "input": Event
  "invalid": Event
  "isolationchange": Event
  "keydown": KeyboardEvent
  "keypress": KeyboardEvent
  "keystatuseschange": Event
  "keyup": KeyboardEvent
  "load": ET extends FileReader ? ProgressEvent<FileReader> : ET extends XMLHttpRequestEventTarget ? ProgressEvent<XMLHttpRequestEventTarget> : Event
  "loadeddata": Event
  "loadedmetadata": Event
  "loadend": Event
  "loadstart": ET extends FileReader ? ProgressEvent<FileReader> : ET extends XMLHttpRequestEventTarget ? ProgressEvent<XMLHttpRequestEventTarget> : Event
  "localcandidate": RTCIceGathererEvent
  "mark": SpeechSynthesisEvent
  "message": Event
  "messageerror": Event
  "mousedown": MouseEvent
  "mouseenter": MouseEvent
  "mouseleave": MouseEvent
  "mousemove": MouseEvent
  "mouseout": MouseEvent
  "mouseover": MouseEvent
  "mouseup": MouseEvent
  "mousewheel": Event
  "mute": Event
  "negotiationneeded": Event
  "nomatch": SpeechRecognitionEvent
  "noupdate": Event
  "obsolete": Event
  "offline": Event
  "online": Event
  "open": Event
  "orientationchange": Event
  "pagehide": PageTransitionEvent
  "pageshow": PageTransitionEvent
  "pause": SpeechSynthesisEvent
  "play": Event
  "playing": Event
  "pointerlockchange": Event
  "pointerlockerror": Event
  "popstate": PopStateEvent
  "processorerror": Event
  "progress": Event
  "ratechange": Event
  "readystatechange": ProgressEvent<Window>
  "removesourcebuffer": Event
  "removetrack": Event
  "reset": Event
  "resize": UIEvent
  "resourcetimingbufferfull": Event
  "result": SpeechRecognitionEvent
  "resume": SpeechSynthesisEvent
  "scroll": Event
  "seeked": Event
  "seeking": Event
  "select": Event
  "selectedcandidatepairchange": Event
  "shippingaddresschange": Event
  "shippingoptionchange": Event
  "show": Event
  "signalingstatechange": Event
  "soundend": Event
  "soundstart": Event
  "sourceclose": Event
  "sourceended": Event
  "sourceopen": Event
  "speechend": Event
  "speechstart": Event
  "stalled": Event
  "start": SpeechSynthesisEvent
  "statechange": Event
  "statsended": RTCStatsEvent
  "storage": StorageEvent
  "submit": Event
  "success": Event
  "suspend": Event
  "timeout": ProgressEvent<XMLHttpRequestEventTarget>
  "timeupdate": Event
  "tonechange": Event
  "track": RTCTrackEvent
  "unload": Event
  "unmute": Event
  "update": Event
  "updateend": Event
  "updatefound": Event
  "updateready": Event
  "updatestart": Event
  "upgradeneeded": IDBVersionChangeEvent
  "versionchange": IDBVersionChangeEvent
  "visibilitychange": Event
  "voiceschanged": Event
  "volumechange": Event
  "vrdisplayactivate": Event
  "vrdisplayblur": Event
  "vrdisplayconnect": Event
  "vrdisplaydeactivate": Event
  "vrdisplaydisconnect": Event
  "vrdisplayfocus": Event
  "vrdisplaypointerrestricted": Event
  "vrdisplaypointerunrestricted": Event
  "vrdisplaypresentchange": Event
  "waiting": Event
  "waitingforkey": Event
}