-- Local development baseline. This file is loaded only by an explicit seed/reset
-- workflow and is not part of remote migration deployment.
update app_portal.settings
set value = jsonb_build_object(
      'mode', 'NORMAL',
      'environment', 'LOCAL'
    ),
    revision = revision + 1
where key = 'platform.mode';
