/**
 * Maps numeric error payloads from `YT.Player` `onError` events.
 * https://developers.google.com/youtube/iframe_api_reference#Events
 */

export function describeYoutubeIframeError(code: number): string {
  switch (code) {
    case 2:
      return "Invalid video parameter.";
    case 5:
      return "HTML5 player error — playback may be unavailable in this browser.";
    case 100:
      return "Video not found or removed.";
    case 101:
    case 150:
      return "Embedding disabled by owner — cannot play inline.";
    default:
      return `Unknown player error (${code}).`;
  }
}
