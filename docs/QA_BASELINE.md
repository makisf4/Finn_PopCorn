# QA Baseline

Manual smoke-test matrix for the browser game. Run the local server, open the game at each viewport, and record pass/fail for every cell.

| Viewport | Start | Movement | Pause | Catch | Miss | Game over | Audio | Leaderboard fallback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 320x568 | Start screen fits; Play starts a run | Touch buttons move Finn | **Known gap:** no visible touch pause control | Catching increases score | Popcorn reaching the floor increments misses | Exactly 3 misses show Game Over and Restart | Mute, unmute, and volume control respond after interaction | Disable/unavailable API still shows local leaderboard without blocking play |
| 390x844 | Start screen fits; Play starts a run | Touch buttons move Finn | **Known gap:** no visible touch pause control | Catching increases score | Popcorn reaching the floor increments misses | Exactly 3 misses show Game Over and Restart | Mute, unmute, and volume control respond after interaction | Disable/unavailable API still shows local leaderboard without blocking play |
| 1366x768 | Start screen fits; Play starts a run | Arrow keys and mouse buttons move Finn | Pause and resume preserve the run | Catching increases score | Popcorn reaching the floor increments misses | Exactly 3 misses show Game Over and Restart | Mute, unmute, and volume control respond after interaction | Disable/unavailable API still shows local leaderboard without blocking play |
