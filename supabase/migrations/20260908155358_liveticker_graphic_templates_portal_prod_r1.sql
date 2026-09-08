create table if not exists app_modules.liveticker_graphic_templates (
  template_key text primary key check (template_key in ('PERIOD_POST','PERIOD_STORY','FINAL_POST','FINAL_STORY')),
  label text not null,
  filename text not null unique,
  graphic_group text not null check (graphic_group in ('PERIOD','FINAL')),
  format text not null check (format in ('POST','STORY')),
  svg_text text not null,
  sha256 text not null,
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table app_modules.liveticker_graphic_templates enable row level security;
revoke all on table app_modules.liveticker_graphic_templates from public, anon, authenticated, service_role;

insert into app_modules.liveticker_graphic_templates(template_key,label,filename,graphic_group,format,svg_text,sha256)
values ('PERIOD_POST','Zwischenstand · POST','period-post.svg','PERIOD','POST',$svg_0$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="1254" height="1254" fill="url(#bg)"/><rect width="1254" height="1254" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 903 Q 627 727 1254 903" stroke-width="8"/><path d="M0 1028 Q 627 853 1254 1028" stroke-width="4"/></g></g>
<text id="headline" class="k" x="627.0" y="145" font-size="92" text-anchor="middle" filter="url(#glow)">ZWISCHENSTAND</text>
        <text id="period_label" class="k" x="627.0" y="225" font-size="52" text-anchor="middle">1. DRITTEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="537.0" y="650" font-size="178" text-anchor="end">0</text><text class="k" x="627.0" y="650" font-size="178" text-anchor="middle">:</text><text id="away_score" class="k" x="717.0" y="650" font-size="178" text-anchor="start">0</text><text id="our_goals_heading" class="k" x="80" y="830" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="80" y="895" font-size="36"></text><text id="our_goals_line_2" class="body" x="80" y="943" font-size="36"></text><text id="our_goals_line_3" class="body" x="80" y="991" font-size="36"></text><text id="our_goals_line_4" class="body" x="80" y="1039" font-size="36"></text><text id="our_goals_line_5" class="body" x="80" y="1087" font-size="36"></text><text id="our_goals_line_6" class="body" x="80" y="1135" font-size="36"></text></svg>$svg_0$,encode(extensions.digest(convert_to($svg_0$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="1254" height="1254" fill="url(#bg)"/><rect width="1254" height="1254" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 903 Q 627 727 1254 903" stroke-width="8"/><path d="M0 1028 Q 627 853 1254 1028" stroke-width="4"/></g></g>
<text id="headline" class="k" x="627.0" y="145" font-size="92" text-anchor="middle" filter="url(#glow)">ZWISCHENSTAND</text>
        <text id="period_label" class="k" x="627.0" y="225" font-size="52" text-anchor="middle">1. DRITTEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="537.0" y="650" font-size="178" text-anchor="end">0</text><text class="k" x="627.0" y="650" font-size="178" text-anchor="middle">:</text><text id="away_score" class="k" x="717.0" y="650" font-size="178" text-anchor="start">0</text><text id="our_goals_heading" class="k" x="80" y="830" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="80" y="895" font-size="36"></text><text id="our_goals_line_2" class="body" x="80" y="943" font-size="36"></text><text id="our_goals_line_3" class="body" x="80" y="991" font-size="36"></text><text id="our_goals_line_4" class="body" x="80" y="1039" font-size="36"></text><text id="our_goals_line_5" class="body" x="80" y="1087" font-size="36"></text><text id="our_goals_line_6" class="body" x="80" y="1135" font-size="36"></text></svg>$svg_0$,'UTF8'),'sha256'),'hex'))
on conflict (template_key) do nothing;

insert into app_modules.liveticker_graphic_templates(template_key,label,filename,graphic_group,format,svg_text,sha256)
values ('PERIOD_STORY','Zwischenstand · STORY','period-story.svg','PERIOD','STORY',$svg_1$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="941" height="1672" viewBox="0 0 941 1672"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="941" height="1672" fill="url(#bg)"/><rect width="941" height="1672" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 1204 Q 470 970 941 1204" stroke-width="8"/><path d="M0 1371 Q 470 1137 941 1371" stroke-width="4"/></g></g>
<text id="headline" class="k" x="470.5" y="170" font-size="80" text-anchor="middle" filter="url(#glow)">ZWISCHENSTAND</text>
        <text id="period_label" class="k" x="470.5" y="265" font-size="48" text-anchor="middle">1. DRITTEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="380.5" y="680" font-size="165" text-anchor="end">0</text><text class="k" x="470.5" y="680" font-size="165" text-anchor="middle">:</text><text id="away_score" class="k" x="560.5" y="680" font-size="165" text-anchor="start">0</text><text id="our_goals_heading" class="k" x="60" y="945" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="60" y="1010" font-size="32"></text><text id="our_goals_line_2" class="body" x="60" y="1064" font-size="32"></text><text id="our_goals_line_3" class="body" x="60" y="1118" font-size="32"></text><text id="our_goals_line_4" class="body" x="60" y="1172" font-size="32"></text><text id="our_goals_line_5" class="body" x="60" y="1226" font-size="32"></text><text id="our_goals_line_6" class="body" x="60" y="1280" font-size="32"></text></svg>$svg_1$,encode(extensions.digest(convert_to($svg_1$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="941" height="1672" viewBox="0 0 941 1672"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="941" height="1672" fill="url(#bg)"/><rect width="941" height="1672" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 1204 Q 470 970 941 1204" stroke-width="8"/><path d="M0 1371 Q 470 1137 941 1371" stroke-width="4"/></g></g>
<text id="headline" class="k" x="470.5" y="170" font-size="80" text-anchor="middle" filter="url(#glow)">ZWISCHENSTAND</text>
        <text id="period_label" class="k" x="470.5" y="265" font-size="48" text-anchor="middle">1. DRITTEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="380.5" y="680" font-size="165" text-anchor="end">0</text><text class="k" x="470.5" y="680" font-size="165" text-anchor="middle">:</text><text id="away_score" class="k" x="560.5" y="680" font-size="165" text-anchor="start">0</text><text id="our_goals_heading" class="k" x="60" y="945" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="60" y="1010" font-size="32"></text><text id="our_goals_line_2" class="body" x="60" y="1064" font-size="32"></text><text id="our_goals_line_3" class="body" x="60" y="1118" font-size="32"></text><text id="our_goals_line_4" class="body" x="60" y="1172" font-size="32"></text><text id="our_goals_line_5" class="body" x="60" y="1226" font-size="32"></text><text id="our_goals_line_6" class="body" x="60" y="1280" font-size="32"></text></svg>$svg_1$,'UTF8'),'sha256'),'hex'))
on conflict (template_key) do nothing;

insert into app_modules.liveticker_graphic_templates(template_key,label,filename,graphic_group,format,svg_text,sha256)
values ('FINAL_POST','Endstand · POST','final-post.svg','FINAL','POST',$svg_2$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="1254" height="1254" fill="url(#bg)"/><rect width="1254" height="1254" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 903 Q 627 727 1254 903" stroke-width="8"/><path d="M0 1028 Q 627 853 1254 1028" stroke-width="4"/></g></g>
<text id="headline" class="k" x="627.0" y="145" font-size="92" text-anchor="middle" filter="url(#glow)">ENDERGEBNIS</text>
        <text id="subheadline" class="k" x="627.0" y="225" font-size="52" text-anchor="middle">TESTSPIEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="537.0" y="650" font-size="178" text-anchor="end">0</text><text class="k" x="627.0" y="650" font-size="178" text-anchor="middle">:</text><text id="away_score" class="k" x="717.0" y="650" font-size="178" text-anchor="start">0</text><text id="result_suffix" class="k" x="872.0" y="650" font-size="42">n.V.</text><g id="series_ribbon"><rect x="437.0" y="705" width="380" height="58" rx="14" fill="#dcecff" opacity=".9"/><text id="series_info" x="627.0" y="748" font-family="Arial Black" font-size="35" text-anchor="middle" fill="#09213a">Serie 0:0</text></g><text id="our_goals_heading" class="k" x="80" y="830" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="80" y="895" font-size="36"></text><text id="our_goals_line_2" class="body" x="80" y="943" font-size="36"></text><text id="our_goals_line_3" class="body" x="80" y="991" font-size="36"></text><text id="our_goals_line_4" class="body" x="80" y="1039" font-size="36"></text><text id="our_goals_line_5" class="body" x="80" y="1087" font-size="36"></text><text id="our_goals_line_6" class="body" x="80" y="1135" font-size="36"></text></svg>$svg_2$,encode(extensions.digest(convert_to($svg_2$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="1254" height="1254" fill="url(#bg)"/><rect width="1254" height="1254" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 903 Q 627 727 1254 903" stroke-width="8"/><path d="M0 1028 Q 627 853 1254 1028" stroke-width="4"/></g></g>
<text id="headline" class="k" x="627.0" y="145" font-size="92" text-anchor="middle" filter="url(#glow)">ENDERGEBNIS</text>
        <text id="subheadline" class="k" x="627.0" y="225" font-size="52" text-anchor="middle">TESTSPIEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="537.0" y="650" font-size="178" text-anchor="end">0</text><text class="k" x="627.0" y="650" font-size="178" text-anchor="middle">:</text><text id="away_score" class="k" x="717.0" y="650" font-size="178" text-anchor="start">0</text><text id="result_suffix" class="k" x="872.0" y="650" font-size="42">n.V.</text><g id="series_ribbon"><rect x="437.0" y="705" width="380" height="58" rx="14" fill="#dcecff" opacity=".9"/><text id="series_info" x="627.0" y="748" font-family="Arial Black" font-size="35" text-anchor="middle" fill="#09213a">Serie 0:0</text></g><text id="our_goals_heading" class="k" x="80" y="830" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="80" y="895" font-size="36"></text><text id="our_goals_line_2" class="body" x="80" y="943" font-size="36"></text><text id="our_goals_line_3" class="body" x="80" y="991" font-size="36"></text><text id="our_goals_line_4" class="body" x="80" y="1039" font-size="36"></text><text id="our_goals_line_5" class="body" x="80" y="1087" font-size="36"></text><text id="our_goals_line_6" class="body" x="80" y="1135" font-size="36"></text></svg>$svg_2$,'UTF8'),'sha256'),'hex'))
on conflict (template_key) do nothing;

insert into app_modules.liveticker_graphic_templates(template_key,label,filename,graphic_group,format,svg_text,sha256)
values ('FINAL_STORY','Endstand · STORY','final-story.svg','FINAL','STORY',$svg_3$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="941" height="1672" viewBox="0 0 941 1672"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="941" height="1672" fill="url(#bg)"/><rect width="941" height="1672" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 1204 Q 470 970 941 1204" stroke-width="8"/><path d="M0 1371 Q 470 1137 941 1371" stroke-width="4"/></g></g>
<text id="headline" class="k" x="470.5" y="170" font-size="80" text-anchor="middle" filter="url(#glow)">ENDERGEBNIS</text>
        <text id="subheadline" class="k" x="470.5" y="265" font-size="48" text-anchor="middle">TESTSPIEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="380.5" y="680" font-size="165" text-anchor="end">0</text><text class="k" x="470.5" y="680" font-size="165" text-anchor="middle">:</text><text id="away_score" class="k" x="560.5" y="680" font-size="165" text-anchor="start">0</text><text id="result_suffix" class="k" x="715.5" y="680" font-size="42">n.V.</text><g id="series_ribbon"><rect x="280.5" y="735" width="380" height="58" rx="14" fill="#dcecff" opacity=".9"/><text id="series_info" x="470.5" y="778" font-family="Arial Black" font-size="35" text-anchor="middle" fill="#09213a">Serie 0:0</text></g><text id="our_goals_heading" class="k" x="60" y="945" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="60" y="1010" font-size="32"></text><text id="our_goals_line_2" class="body" x="60" y="1064" font-size="32"></text><text id="our_goals_line_3" class="body" x="60" y="1118" font-size="32"></text><text id="our_goals_line_4" class="body" x="60" y="1172" font-size="32"></text><text id="our_goals_line_5" class="body" x="60" y="1226" font-size="32"></text><text id="our_goals_line_6" class="body" x="60" y="1280" font-size="32"></text></svg>$svg_3$,encode(extensions.digest(convert_to($svg_3$<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="941" height="1672" viewBox="0 0 941 1672"><defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06182d"/><stop offset="0.55" stop-color="#0b3158"/><stop offset="1" stop-color="#b8d8ef"/></linearGradient>
      <radialGradient id="ice" cx="50%" cy="82%" r="55%"><stop offset="0" stop-color="#ffffff" stop-opacity=".72"/><stop offset="1" stop-color="#7db8df" stop-opacity="0"/></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>.k{font-family:'Komika Axis','Arial Black',Impact,sans-serif;font-weight:900;fill:#f5fbff} .body{font-family:Arial,sans-serif;font-weight:700;fill:#fff}</style>
    </defs>
<g id="background_image"></g><g id="background_placeholder">
    <rect width="941" height="1672" fill="url(#bg)"/><rect width="941" height="1672" fill="url(#ice)"/>
    <g opacity=".22" stroke="#ccecff" fill="none"><path d="M0 1204 Q 470 970 941 1204" stroke-width="8"/><path d="M0 1371 Q 470 1137 941 1371" stroke-width="4"/></g></g>
<text id="headline" class="k" x="470.5" y="170" font-size="80" text-anchor="middle" filter="url(#glow)">ENDERGEBNIS</text>
        <text id="subheadline" class="k" x="470.5" y="265" font-size="48" text-anchor="middle">TESTSPIEL</text><g id="logo_home"></g><g id="logo_away"></g><text id="home_score" class="k" x="380.5" y="680" font-size="165" text-anchor="end">0</text><text class="k" x="470.5" y="680" font-size="165" text-anchor="middle">:</text><text id="away_score" class="k" x="560.5" y="680" font-size="165" text-anchor="start">0</text><text id="result_suffix" class="k" x="715.5" y="680" font-size="42">n.V.</text><g id="series_ribbon"><rect x="280.5" y="735" width="380" height="58" rx="14" fill="#dcecff" opacity=".9"/><text id="series_info" x="470.5" y="778" font-family="Arial Black" font-size="35" text-anchor="middle" fill="#09213a">Serie 0:0</text></g><text id="our_goals_heading" class="k" x="60" y="945" font-size="40">UNSERE TORE</text><text id="our_goals_line_1" class="body" x="60" y="1010" font-size="32"></text><text id="our_goals_line_2" class="body" x="60" y="1064" font-size="32"></text><text id="our_goals_line_3" class="body" x="60" y="1118" font-size="32"></text><text id="our_goals_line_4" class="body" x="60" y="1172" font-size="32"></text><text id="our_goals_line_5" class="body" x="60" y="1226" font-size="32"></text><text id="our_goals_line_6" class="body" x="60" y="1280" font-size="32"></text></svg>$svg_3$,'UTF8'),'sha256'),'hex'))
on conflict (template_key) do nothing;

create or replace function app_private.api_liveticker_graphic_templates_list()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  perform app_private.liveticker_actor();
  return jsonb_build_object('templates',coalesce((
    select jsonb_agg(jsonb_build_object(
      'key',t.template_key,'label',t.label,'filename',t.filename,'group',t.graphic_group,'format',t.format,
      'svgText',t.svg_text,'sha256',t.sha256,'revision',t.revision,'updatedAt',t.updated_at
    ) order by case t.template_key when 'PERIOD_POST' then 1 when 'PERIOD_STORY' then 2 when 'FINAL_POST' then 3 else 4 end)
    from app_modules.liveticker_graphic_templates t
  ),'[]'::jsonb));
end;
$$;

create or replace function app_private.api_liveticker_graphic_template_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid;
  v_key text:=upper(btrim(coalesce(p_payload->>'key','')));
  v_svg text:=coalesce(p_payload->>'svgText','');
  v_expected integer;
  v_old app_modules.liveticker_graphic_templates%rowtype;
  v_id text;
  v_required text[]:=array['background_image','headline','logo_home','logo_away','home_score','away_score','our_goals_heading','our_goals_line_1','our_goals_line_2','our_goals_line_3','our_goals_line_4','our_goals_line_5','our_goals_line_6'];
begin
  v_actor:=app_private.liveticker_actor();
  if v_key not in ('PERIOD_POST','PERIOD_STORY','FINAL_POST','FINAL_STORY') then raise exception 'Unbekannte Grafikvorlage.' using errcode='22023'; end if;
  begin v_expected:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  exception when invalid_text_representation then raise exception 'Ungültige Vorlagen-Version.' using errcode='22023'; end;
  if v_expected is null then raise exception 'Vorlagen-Version fehlt.' using errcode='22023'; end if;
  if octet_length(convert_to(v_svg,'UTF8')) < 200 or octet_length(convert_to(v_svg,'UTF8')) > 524288 then raise exception 'SVG-Vorlage muss zwischen 200 Byte und 512 KB groß sein.' using errcode='22023'; end if;
  if v_svg !~* '<svg([[:space:]>])' or upper(v_svg) like '%<!DOCTYPE%' or v_svg ~* '<script([[:space:]>])' or v_svg ~* 'javascript[[:space:]]*:' or v_svg ~* 'onload[[:space:]]*=' then raise exception 'SVG-Vorlage enthält nicht erlaubte Inhalte.' using errcode='22023'; end if;
  if v_key in ('PERIOD_POST','FINAL_POST') then
    if v_svg !~* 'viewBox[[:space:]]*=[[:space:]]*["'']0[[:space:]]+0[[:space:]]+1254([.]0+)?[[:space:]]+1254([.]0+)?["'']' then raise exception 'POST-Vorlage muss den viewBox 0 0 1254 1254 besitzen.' using errcode='22023'; end if;
  else
    if v_svg !~* 'viewBox[[:space:]]*=[[:space:]]*["'']0[[:space:]]+0[[:space:]]+941([.]0+)?[[:space:]]+1672([.]0+)?["'']' then raise exception 'STORY-Vorlage muss den viewBox 0 0 941 1672 besitzen.' using errcode='22023'; end if;
  end if;
  foreach v_id in array v_required loop
    if v_svg !~* ('id[[:space:]]*=[[:space:]]*(["'']'||v_id||'["''])') then raise exception 'SVG-Vorlage enthält das Pflichtfeld % nicht.',v_id using errcode='22023'; end if;
  end loop;
  if v_key like 'PERIOD_%' then
    if v_svg !~* 'id[[:space:]]*=[[:space:]]*["'']period_label["'']' then raise exception 'Zwischenstands-Vorlage enthält period_label nicht.' using errcode='22023'; end if;
  else
    foreach v_id in array array['subheadline','result_suffix','series_ribbon','series_info'] loop
      if v_svg !~* ('id[[:space:]]*=[[:space:]]*(["'']'||v_id||'["''])') then raise exception 'Endstands-Vorlage enthält das Pflichtfeld % nicht.',v_id using errcode='22023'; end if;
    end loop;
  end if;
  select * into v_old from app_modules.liveticker_graphic_templates where template_key=v_key for update;
  if not found then raise exception 'Grafikvorlage wurde nicht gefunden.' using errcode='P0002'; end if;
  if v_expected<>v_old.revision then raise exception 'Die Grafikvorlage wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
  update app_modules.liveticker_graphic_templates set svg_text=v_svg,sha256=encode(extensions.digest(convert_to(v_svg,'UTF8'),'sha256'),'hex'),revision=revision+1,updated_at=now(),updated_by=v_actor where template_key=v_key;
  return app_private.api_liveticker_graphic_templates_list();
end;
$$;

create or replace function app_private.liveticker_graphic_job_attach_templates()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_post app_modules.liveticker_graphic_templates%rowtype; v_story app_modules.liveticker_graphic_templates%rowtype;
begin
  if new.graphic_kind='FINAL' then
    select * into v_post from app_modules.liveticker_graphic_templates where template_key='FINAL_POST';
    select * into v_story from app_modules.liveticker_graphic_templates where template_key='FINAL_STORY';
  else
    select * into v_post from app_modules.liveticker_graphic_templates where template_key='PERIOD_POST';
    select * into v_story from app_modules.liveticker_graphic_templates where template_key='PERIOD_STORY';
  end if;
  if v_post.template_key is null or v_story.template_key is null then raise exception 'LIVETICKER_GRAPHIC_TEMPLATE_MISSING' using errcode='22023'; end if;
  new.request_snapshot:=jsonb_set(coalesce(new.request_snapshot,'{}'::jsonb),'{graphicTemplates}',jsonb_build_object(
    'post',jsonb_build_object('filename',v_post.filename,'svgText',v_post.svg_text,'sha256',v_post.sha256,'revision',v_post.revision),
    'story',jsonb_build_object('filename',v_story.filename,'svgText',v_story.svg_text,'sha256',v_story.sha256,'revision',v_story.revision)),true);
  return new;
end;
$$;

drop trigger if exists liveticker_graphic_jobs_attach_templates on app_modules.liveticker_graphic_jobs;
create trigger liveticker_graphic_jobs_attach_templates before insert on app_modules.liveticker_graphic_jobs for each row execute function app_private.liveticker_graphic_job_attach_templates();

alter function app_private.pd_api_dispatch_current(text,jsonb) rename to pd_api_dispatch_current_before_liveticker_graphic_templates_prod_r1;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_action text:=lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'liveticker_graphic_templates_list' then return app_private.api_liveticker_graphic_templates_list();
    when 'liveticker_graphic_template_save' then return app_private.api_liveticker_graphic_template_save(coalesce(p_payload,'{}'::jsonb));
    else return app_private.pd_api_dispatch_current_before_liveticker_graphic_templates_prod_r1(p_action,p_payload);
  end case;
end;
$$;

alter function app_private.platform_action_classification(text) rename to platform_action_classification_before_liveticker_graphic_templates_prod_r1;
create function app_private.platform_action_classification(p_action text)
returns text language sql stable set search_path='' as $$
  select case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_graphic_templates_list' then 'READ'
    when 'liveticker_graphic_template_save' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_graphic_templates_prod_r1(p_action)
  end
$$;

revoke all on function app_private.api_liveticker_graphic_templates_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_graphic_template_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.liveticker_graphic_job_attach_templates() from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_graphic_templates_prod_r1(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.platform_action_classification_before_liveticker_graphic_templates_prod_r1(text) from public,anon,authenticated;
revoke all on function app_private.platform_action_classification(text) from public,anon,authenticated;
