-- DEV only: period/final graphics are now explicitly requested from the Liveticker UI.
-- Reaching/crossing minute 20/40 or completing a game must not enqueue graphics automatically.

drop trigger if exists liveticker_graphic_autqueue_r1
  on app_modules.liveticker_game_states;
