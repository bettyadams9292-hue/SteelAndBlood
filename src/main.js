/* Boot. */
'use strict';
window.addEventListener('load', () => {
  IF.game.init();
  IF.touch.init();
  // expose a small debug/test API (used by the automated QA suite)
  window.SB = { IF, version: IF.VERSION };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (IF.game.state === 'playing') IF.game.pause(); IF.save.write(); } });
  window.addEventListener('beforeunload', () => IF.save.write());
});
