-- DEV: keep operator-facing Liveticker output variants content-identical to PROD.
-- Stable template_key values are used; environment-specific revision/timestamps remain local.

update app_modules.liveticker_output_templates
set own_goal_title = 'Normal',
    own_goal_template = $q1${{minute}} Spielminute
*Tooooooor* für unsere Schweinfurter Mighty Dogs

Torschütze mit der {{scorer}}
Assists: {{assists}}

Neuer Spielstand
{{score}}$q1$,
    opponent_goal_title = 'Normal',
    opponent_goal_template = $q2${{minute}} Spielminute
Tor {{opponent_name}}

Neuer Spielstand
{{score}}$q2$,
    own_penalty_title = 'Normal',
    own_penalty_template = $q3${{minute}} Spielminute
Strafe(n)

{{penalties}}$q3$,
    opponent_penalty_title = 'Normal',
    opponent_penalty_template = $q4${{minute}} Spielminute
Strafe(n)

{{penalties}}$q4$,
    revision = revision + 1,
    updated_at = now()
where template_key = 'classic';

update app_modules.liveticker_output_templates
set own_goal_title = 'Emotional',
    own_goal_template = $q5${{minute}} Spielminute
*TOOOOOOOOOOOOR FÜR UNSERE SCHWEINFURTER MIGHTY DOGS!* 🔥

Torschütze mit der {{scorer}}
Assists: {{assists}}

Neuer Spielstand:
{{score}}$q5$,
    opponent_goal_title = 'Mit Scorer',
    opponent_goal_template = $q6${{minute}} Spielminute
Tor {{opponent_name}}
Torschütze: {{scorer}}
Assists: {{assists}}

Neuer Spielstand
{{score}}$q6$,
    own_penalty_title = 'Beide Mannschaften',
    own_penalty_template = $q7${{minute}} Spielminute
Strafe(n) beide Mannschaften 

{{penalties}}$q7$,
    opponent_penalty_title = 'Mit Scorer',
    opponent_penalty_template = $q8${{minute}} Spielminute
Strafe(n)

{{penalties}}$q8$,
    revision = revision + 1,
    updated_at = now()
where template_key = 'emotional';

update app_modules.liveticker_output_templates
set own_goal_title = 'Hattrick',
    own_goal_template = $q9${{minute}} Spielminute
*TOOOOOOOOOOOOR* für unsere Schweinfurter Mighty Dogs

Torschütze zu seinem 3ten Tor und damit einen *HATTRICK* {{scorer}}
Assists: {{assists}}

Neuer Spielstand:
{{score}}$q9$,
    opponent_goal_title = 'Hattrick',
    opponent_goal_template = $q10${{minute}} Spielminute
Tor {{opponent_name}}
Zum 3ten Mal der selbe Depp von {{opponent_score}} 
Hattrick für {{scorer}} 😵🙄
Assists: {{assists}}

{{score}}$q10$,
    own_penalty_title = 'Spieldauer',
    own_penalty_template = $q11${{minute}} Spielminute
Oh Oh ein Dog hat es übertriben 
Spieldauer Strafe(n)

{{penalties}}$q11$,
    opponent_penalty_title = 'Hattrick',
    opponent_penalty_template = $q12${{minute}} Spielminute
Strafe(n)

{{penalties}}$q12$,
    revision = revision + 1,
    updated_at = now()
where template_key = 'short';
