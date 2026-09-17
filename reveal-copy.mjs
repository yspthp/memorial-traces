export const REVEAL_COPY_TIMING = Object.freeze({
  titleDelay: 3000,
  messageDelay: 5000,
  fadeDuration: 1500
});
const ease = value => { const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t); };
// A single state clock avoids orphaned timers after stop, replay or another round.
// Reduced-motion users retain the pauses, but skip the opacity animation.
export function revealCopyAt(elapsed,reducedMotion=false){
  const {titleDelay,messageDelay,fadeDuration}=REVEAL_COPY_TIMING;
  const opacity=delay=>reducedMotion?Number(elapsed>=delay):ease((elapsed-delay)/fadeDuration);
  return {
    title:elapsed>=titleDelay?'你一直被看見。':'',
    message:elapsed>=messageDelay?'你的每一個痕跡，在神眼中都是最寶貴的。':'',
    titleOpacity:opacity(titleDelay),
    messageOpacity:opacity(messageDelay)
  };
}
