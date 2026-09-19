// A brief full-viewport red flash on confirming a high-stakes alert — needs
// to read screen-wide, not just inside one alert card, so it's a tiny
// pub/sub over a DOM event rather than threading state through props.
export function triggerConfirmFlash() {
  window.dispatchEvent(new CustomEvent('ibvap:confirm-flash'))
}
