-- DEV: render goal score lines from the canonical home : away placeholder.

update app_modules.liveticker_output_templates
set own_goal_template = replace(
      replace(own_goal_template, '{{opponent_score}} : {{mighty_score}}', '{{score}}'),
      '{{mighty_score}}:{{opponent_score}}', '{{score}}'
    ),
    opponent_goal_template = replace(
      replace(opponent_goal_template, '{{opponent_score}} : {{mighty_score}}', '{{score}}'),
      '{{mighty_score}}:{{opponent_score}}', '{{score}}'
    ),
    revision = revision + 1,
    updated_at = now()
where template_key in ('classic','emotional','short');
