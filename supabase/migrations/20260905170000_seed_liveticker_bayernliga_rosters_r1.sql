-- Plärrdeifl Portal V4
-- Liveticker R3: Bayernliga 2026/27 Gegner und Kader als DEV-Seed.
-- Quellenstand: 05.09.2026.
-- Primär: Bayernhockey Saison 2026/27.
-- Aktuellere Ergänzungen: offizielle Teamseiten ESC Dorfen und EA Schongau sowie aktuelle Transfermeldungen.
-- Unbekannte Rückennummern bleiben NULL und können im Portal gepflegt werden.
-- PROD bleibt unangetastet: außerhalb environment=DEV wird der Seed übersprungen.
--
-- HC Landsberg Riverkings: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=129
-- ERSC Amberg: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=112
-- EHC Klostersee: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=79
-- EHC Waldkraiburg "Die Löwen": https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=82
-- Peißenberg Miners: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=33
-- ESC River Rats Geretsried: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=109
-- EV Dingolfing Isarrats: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=80
-- ESC Dorfen: https://esc-dorfen.de/eispiraten/team/
-- EHC Königsbrunn: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=151
-- VfE Ulm / Neu-Ulm: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=130
-- TEV Miesbach: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=120
-- ESV Buchloe: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=64
-- ESC Kempten: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=116
-- EA im TSV Schongau 1863: https://www.schongau-mammuts.de/schongau-mammuts/
-- ESV Burgau 2000: https://www.bayernhockey.com/teams_players/showteam.php?saison=2026&teamid=68

do $$
declare
  v_environment text;
  v_teams jsonb := $teams${
    "1":{"name":"HC Landsberg Riverkings","short":"Landsberg"},
    "2":{"name":"ERSC Amberg","short":"Amberg"},
    "3":{"name":"EHC Klostersee","short":"Klostersee"},
    "4":{"name":"EHC Waldkraiburg \"Die Löwen\"","short":"Waldkraiburg"},
    "5":{"name":"Peißenberg Miners","short":"Peißenberg"},
    "6":{"name":"ESC River Rats Geretsried","short":"Geretsried"},
    "7":{"name":"EV Dingolfing Isarrats","short":"Dingolfing"},
    "8":{"name":"ESC Dorfen","short":"Dorfen"},
    "9":{"name":"EHC Königsbrunn","short":"Königsbrunn"},
    "10":{"name":"VfE Ulm / Neu-Ulm","short":"Ulm/Neu-Ulm"},
    "11":{"name":"TEV Miesbach","short":"Miesbach"},
    "12":{"name":"ESV Buchloe","short":"Buchloe"},
    "13":{"name":"ESC Kempten","short":"Kempten"},
    "14":{"name":"EA im TSV Schongau 1863","short":"Schongau"},
    "15":{"name":"ESV Burgau 2000","short":"Burgau"}
  }$teams$::jsonb;
  v_code text;
  v_team jsonb;
  v_team_id uuid;
  v_line text;
  v_parts text[];
  v_team_name text;
  v_number text;
begin
  select setting.value ->> 'environment'
    into v_environment
  from app_portal.settings as setting
  where setting.key = 'platform.mode';

  if v_environment is distinct from 'DEV' then
    raise notice 'Skipping Liveticker Bayernliga roster seed outside DEV.';
    return;
  end if;

  for v_code, v_team in select key, value from jsonb_each(v_teams)
  loop
    select team.id into v_team_id
    from app_modules.liveticker_teams team
    where lower(btrim(team.name)) = lower(btrim(v_team ->> 'name'));

    if v_team_id is null then
      insert into app_modules.liveticker_teams(name, short_name, logo_url, is_home_club, is_active)
      values (v_team ->> 'name', v_team ->> 'short', null, false, true)
      returning id into v_team_id;
    else
      update app_modules.liveticker_teams
         set short_name = v_team ->> 'short',
             is_active = true,
             updated_at = now()
       where id = v_team_id
         and not is_home_club;
    end if;
  end loop;

  foreach v_line in array string_to_array($roster$
1|32|Moritz Borst|GOALIE
1|48|Michael Karg|GOALIE
1|6|Maximilian Hermann|DEFENSE
1|12|Lorenzo Valenti|DEFENSE
1|29|Dominic Erdt|DEFENSE
1|55|Christopher Kasten|DEFENSE
1|58|Tobias Wedl|DEFENSE
1|72|Florian Reicheneder|DEFENSE
1|79|Laurin Schadel|DEFENSE
1|9|Luca Kinzel|FORWARD
1|18|Luis Hegner|FORWARD
1|28|Mika Reuter|FORWARD
1|41|Egils Kalns|FORWARD
1|44|Jonas Huber|FORWARD
1|69|Lukas Heß|FORWARD
1|77|Raivo Freidenfelds|FORWARD
1|89|Manuel Müller|FORWARD
1|96|Victor Oestling|FORWARD
1|97|Frantisek Wagner|FORWARD
2|31|Timon Bätge|GOALIE
2|72|David Kubik|GOALIE
2|2|Mauritz Silbermann|DEFENSE
2|6|Tobias Vait|DEFENSE
2|19|Kevin Schmitt|DEFENSE
2|22|Tomas Schmidt|DEFENSE
2|52|Max Gimmel|DEFENSE
2|76|Felix Feder|DEFENSE
2|95|Lukas Salinger|DEFENSE
2|3|Cooper Fensterstock|FORWARD
2|14|Dennis Gulda|FORWARD
2|21|Fabian Broll|FORWARD
2|25|Lukas Krieger|FORWARD
2|27|Roberts Baranovskis|FORWARD
2|29|Daniel Schröpfer|FORWARD
2|36|Lukas Klughardt|FORWARD
2|53|Daniel Rolsing|FORWARD
2|88|Jakub Bitomsky|FORWARD
2|96|Brendan Walkom|FORWARD
2|97|Daniel Krieger|FORWARD
3|30|Lukas Steinhauer|GOALIE
3|31|Clemens Stocker|GOALIE
3|32|Patrick Mayer|GOALIE
3|7|Nicolai Quinlan|DEFENSE
3|10|Jan Fiedler|DEFENSE
3|11|Liam Hätinen|DEFENSE
3|13|Tobias Hilger|DEFENSE
3|22|Christian Hummer|DEFENSE
3|35|Patrick Kerndl|DEFENSE
3|9|Tyler Braccini|FORWARD
3|10|Simon Roeder|FORWARD
3|14|Ferdinand Löchle|FORWARD
3|18|Lorenz Mühlfenzl|FORWARD
3|19|Matthias Baumhackl|FORWARD
3|24|Julian Dengl|FORWARD
3|25|Vitus Gleixner|FORWARD
3|26|Florian Gaschke|FORWARD
3|61|Philipp Quinlan|FORWARD
3|69|Jan Tlacil|FORWARD
3|88|Alexandre Gagnon|FORWARD
4|32|Tobias Sickinger|GOALIE
4|40|Christoph Lode|GOALIE
4|5|Rene Mertz|DEFENSE
4|6|Matej Houdek|DEFENSE
4|10|Felix Lode|DEFENSE
4|23|Tim Ludwig|DEFENSE
4|33|Martin Kokeš|DEFENSE
4|81|Max Cejka|DEFENSE
4|96|Dmitri Sergeyev|DEFENSE
4|98|Patrick Zimmermann|DEFENSE
4|7|Philipp Lode|FORWARD
4|11|Bartek Bison|FORWARD
4|13|Jakub Sramek|FORWARD
4|18|Santeri Ovaska|FORWARD
4|25|Andris Dzerins|FORWARD
4|28|Mikko Happaranta|FORWARD
4|34|Leon Decker|FORWARD
4|63|Paul Hipetinger|FORWARD
4|74|Florian Maierhofer|FORWARD
4|78|Philip Kaer|FORWARD
4|88|Nico Vogl|FORWARD
4|92|Jakub Revaj|FORWARD
5|31|Josef Probst|GOALIE
5|32|Andreas Magg|GOALIE
5|33|Maximilian Berger|GOALIE
5||Leon Seelmann|DEFENSE
5|27|Fynn Wager|DEFENSE
5|64|Marek Haloda|DEFENSE
5|67|Maximilian Malzatzki|DEFENSE
5|87|Florian Riedel|DEFENSE
5|88|Samih Ondörtoglu|DEFENSE
5|91|Dominik Ebentheuer|DEFENSE
5||Elias Maier|FORWARD
5|7|Niklas Kienle|FORWARD
5|13|Weiland Parrish|FORWARD
5|14|Florian Höfler|FORWARD
5|15|Ryan Murphy|FORWARD
5|18|Valentin Hörndl|FORWARD
5|21|Florian Seelmann|FORWARD
5|22|Sinan Ondörtoglu|FORWARD
5|23|Dejan Vogl|FORWARD
5|28|Denis Degenstein|FORWARD
5|44|Ilya Zheltakov|FORWARD
5|82|Nepomuk Rieger|FORWARD
5|95|Moritz Birkner|FORWARD
6|30|Maximilian Freytag|GOALIE
6|31|Korbinian Sertl|GOALIE
6|57|Benedikt Goldschmidt|GOALIE
6|19|Kilian Mühlpointner|DEFENSE
6|28|Martin Sanner|DEFENSE
6|33|Stephan Englbrecht|DEFENSE
6|53|Michael Kristic|DEFENSE
6|60|Moritz Schug|DEFENSE
6|93|Oliver Ott|DEFENSE
6|9|Anton Egle|FORWARD
6|10|Dominik Soukup|FORWARD
6|12|Sebastian Heininger|FORWARD
6|13|Gunars Skvorcovs|FORWARD
6|38|Maximilian Hüsken|FORWARD
6|70|Ondrej Horváth|FORWARD
6|77|Luis Huber|FORWARD
7|31|Christoph Schedlbauer|GOALIE
7|37|Louis Eisenhut|GOALIE
7|4|Simon Franz|DEFENSE
7|7|Dominik König|DEFENSE
7|9|Kevin Lengle|DEFENSE
7|16|Finn Teubner|DEFENSE
7|20|Alessandro Schmidbauer|DEFENSE
7|65|Maximilian Huber|DEFENSE
7|11|Davin Maus|FORWARD
7|17|Niklas Zeilbeck|FORWARD
7|18|Leon Draser|FORWARD
7|19|Blake Luscombe|FORWARD
7|23|Björn Salhi|FORWARD
7|26|Lucas Dittlein|FORWARD
7|27|Mitch Walinski|FORWARD
7|88|Joey Oberrauch|FORWARD
7|92|Christian Neuert|FORWARD
7|94|Stanja Picha|FORWARD
7|96|David Zucker|FORWARD
8|30|Andreas Marek|GOALIE
8|31|Simon von Fraunberg|GOALIE
8|8|Tobias Cramer|DEFENSE
8|10|Mark Waldhausen|DEFENSE
8|17|Vaclav Krlis|DEFENSE
8|37|Quirin Brugger|DEFENSE
8|72|Erik Walter|DEFENSE
8|91|Moritz Geier|DEFENSE
8|96|Paul Geier|DEFENSE
8||Ole Krüger|DEFENSE
8|6|Christoph Lönnig|FORWARD
8|14|Maxi Steiner|FORWARD
8|15|Kevin Schinko|FORWARD
8|16|Sandro Schroepfer|FORWARD
8|22|David Stach|FORWARD
8|25|Michael Franz|FORWARD
8|87|Sebastian Kosmann|FORWARD
8|88|Vaclav Adamec|FORWARD
8|89|Fabio Lauffer|FORWARD
8||Jakub Naar|FORWARD
9|49|Nicolas Hetzel|GOALIE
9|32|Stefan Vajs|GOALIE
9|67|David Farny|DEFENSE
9|73|David Kaiser|DEFENSE
9|65|Niklas Länger|DEFENSE
9|46|Marc Streicher|DEFENSE
9|13|Luca Szegedin|DEFENSE
9|13|Steffen Tölzer|DEFENSE
9|15|Moritz Weißenhorn|DEFENSE
9|55|Nicolas Baur|FORWARD
9|33|Peter Brückner|FORWARD
9|8|Tim Bullnheimer|FORWARD
9|88|Kevin Hu|FORWARD
9|23|Stefan Rodrigues|FORWARD
9|6|Marco Sternheimer|FORWARD
9|43|Hayden Trupp|FORWARD
9|17|Philipp Markgraf|FORWARD
9|19|Anton Seidel|FORWARD
9|22|Tim Flammann|FORWARD
9|47|Justin Maylan|FORWARD
9|72|Kilian Steinmann|FORWARD
10|3|David Heckenberger|GOALIE
10|21|Nikita Manuilov|GOALIE
10|11|Felix Anwander|DEFENSE
10|23|Daniel Bartuli|DEFENSE
10|64|Yannick Kischer|DEFENSE
10|71|Philipp Wirz|DEFENSE
10|92|Lorenz Landerer|DEFENSE
10|10|Martín Podešva|FORWARD
10|13|Julian Tischendorf|FORWARD
10|14|Dominik Synek|FORWARD
10|17|Joona Schneider|FORWARD
10|19|Elvijs Biezais|FORWARD
10|27|Valentin Dér|FORWARD
10|41|Jakub Bernad|FORWARD
10|47|Alexander Rudkovski|FORWARD
10|55|Ludwig Danzer|FORWARD
10|69|Michael Wirz|FORWARD
10|91|Bohumil Slavicek|FORWARD
11|31|Philip Lehr|GOALIE
11|34|Timon Ewert|GOALIE
11|40|Simon Maier|GOALIE
11|7|Benedikt Dietrich|DEFENSE
11|9|Stefan Kuhn|DEFENSE
11|12|Henry Sihling|DEFENSE
11|19|Valentin Kroha|DEFENSE
11|20|Danyel Waizmann|DEFENSE
11|96|Andreas Nowak|DEFENSE
11|98|Maximilian Vollmayer|DEFENSE
11|2|Xaver Schuler|FORWARD
11|3|Thomas März|FORWARD
11|9|Kelvin Walz|FORWARD
11|16|Patrick Asselin|FORWARD
11|24|Moritz Schlickenrieder|FORWARD
11|28|Aziz Ehliz|FORWARD
11|29|Laurenz Haltmair|FORWARD
11|39|Dennis Reimer|FORWARD
11|69|Matej Pekr|FORWARD
11|77|Benedikt Pölt|FORWARD
11|85|Alexander Christofori|FORWARD
11|91|Michael Mayer|FORWARD
11|95|Athanassios Fissekis|FORWARD
12|31|David Blaschta|GOALIE
12|39|Fabian Hartmann|GOALIE
12|86|Emanuel Geiger|GOALIE
12||Derek Raposo|DEFENSE
12|9|Nico Nieberle|DEFENSE
12|33|Alexander Lieske|DEFENSE
12|47|Alexander Thiel|DEFENSE
12|71|Johannes Keller|DEFENSE
12|98|Philipp Keil|DEFENSE
12|8|Korbinian Benz|FORWARD
12|11|Nicolas Strodel|FORWARD
12|17|Emil Gabrielson|FORWARD
12|21|Mateo Cabral|FORWARD
12|25|Marc Krammer|FORWARD
12|27|Tim Lutz|FORWARD
12|69|Felix Schurr|FORWARD
12|73|Michal Telesz|FORWARD
12|88|Maximilian Stöhr|FORWARD
12|93|Lars Grözinger|FORWARD
13|52|Jakob Nerb|GOALIE
13|53|Bastian Flott-Kucis|GOALIE
13|19|Maximilian Miller|DEFENSE
13|27|Tomas Kulhánek|DEFENSE
13|33|Sven Schirrmacher|DEFENSE
13|34|Michael Limböck|DEFENSE
13|91|Mauro Seider|DEFENSE
13|97|Kevin Marquardt|DEFENSE
13|3|Timo Schirrmacher|FORWARD
13|7|Clemens Löhr|FORWARD
13|14|Niklas Salo|FORWARD
13|23|Pascal Dopatka|FORWARD
13|43|Tobias Nöß|FORWARD
13|46|Filip Kokoska|FORWARD
13|64|Eetu Elo|FORWARD
13|79|Kevin Steiner|FORWARD
13|87|Martin Hlozek|FORWARD
13|88|Milan Pfalzer|FORWARD
13|92|Maximilian Schäffler|FORWARD
14|25|Daniel Blankenburg|GOALIE
14|30|Ludwig Negele|GOALIE
14|67|Xaver Nagel|GOALIE
14|10|Fabian Weber|DEFENSE
14|20|Fabian Hickl|DEFENSE
14|23|Moritz Eberle|DEFENSE
14|47|Thomas Radu|DEFENSE
14|81|Leonhard Zink|DEFENSE
14|84|Tim Mühlegger|DEFENSE
14||Maximilian Sterz|DEFENSE
14|7|Yannis Steffens|FORWARD
14|8|Marcel Forstner|FORWARD
14|11|Maximilian Weber|FORWARD
14|13|Clay Ellerbrock|FORWARD
14|22|Niklas Greil|FORWARD
14|28|Kurt Sonne|FORWARD
14|55|Marco Munzig|FORWARD
14|65|Florian Stauder|FORWARD
14|83|Jonathan Schubert|FORWARD
14|87|Dominic Krabbat|FORWARD
14||Sergei Stas|FORWARD
14||Tom Callaghan|FORWARD
14|92|Lukas Skvarek|FORWARD
14||Raphael Pfleger|FORWARD
15|29|Louis Waaßmann|GOALIE
15|30|Roman Jourkov|GOALIE
15|95|Gustavs Samitis|GOALIE
15|3|Marshall Renke|DEFENSE
15|16|Jakub Michálek|DEFENSE
15|17|Niklas Dörrich|DEFENSE
15|19|Max Petzold|DEFENSE
15|21|David Heinrich|DEFENSE
15|32|Patrick Spingler|DEFENSE
15|34|Max Schieskow|DEFENSE
15|86|Marcel Kunc|DEFENSE
15|7|Tim Söldner|FORWARD
15|8|Lukas Widowitz|FORWARD
15|9|Balint Makovics|FORWARD
15|10|Benedek Radvanji|FORWARD
15|11|Luca Imminger|FORWARD
15|13|Louis Herbrik|FORWARD
15|22|Andreas Wiesler|FORWARD
15|24|David Zachar|FORWARD
15|26|David Ballner|FORWARD
15|27|Petr Ceslik|FORWARD
15|28|Jannik Liebs|FORWARD
15|33|Maximilian Kaschner|FORWARD
15||Marek Rubner|FORWARD
$roster$, E'\n')
  loop
    if btrim(v_line) = '' then
      continue;
    end if;

    v_parts := string_to_array(v_line, '|');
    if array_length(v_parts, 1) <> 4 then
      raise exception 'LIVETICKER_ROSTER_SEED_INVALID_LINE: %', v_line;
    end if;

    v_team := v_teams -> v_parts[1];
    v_team_name := v_team ->> 'name';
    v_number := nullif(btrim(v_parts[2]), '');

    select team.id into v_team_id
    from app_modules.liveticker_teams team
    where lower(btrim(team.name)) = lower(btrim(v_team_name));

    if v_team_id is null then
      raise exception 'LIVETICKER_ROSTER_SEED_TEAM_MISSING: %', v_team_name;
    end if;

    if not exists (
      select 1
      from app_modules.liveticker_players player
      where player.team_id = v_team_id
        and lower(btrim(player.full_name)) = lower(btrim(v_parts[3]))
    ) then
      insert into app_modules.liveticker_players(
        team_id, full_name, jersey_number, position, is_active
      ) values (
        v_team_id, btrim(v_parts[3]), v_number, btrim(v_parts[4]), true
      );
    end if;
  end loop;
end;
$$;
