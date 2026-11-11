/**
 * The lazy boundary for Mux Player. ClassDetail loads this file with
 * React.lazy, so the player, Media Chrome, casting and Mux's own hls.js land
 * in one chunk named after this module (an anonymous `index-*.js` chunk was
 * mistaken for the app's main chunk by the size budgets). Nothing else should
 * import `@mux/mux-player-react` for its value.
 */
export { default } from "@mux/mux-player-react";
