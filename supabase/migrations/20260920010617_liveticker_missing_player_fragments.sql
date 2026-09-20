-- Plärrdeifl Portal V4 - editable missing-player text fragments
begin;

insert into app_modules.liveticker_output_types(
  type_key,label,description,category,sort_order,allowed_variables,required_variables
) values
  ('missing_goal_scorer','Textbaustein · Torschütze fehlt','Fallback, wenn bei einem Tor kein Torschütze erfasst wurde.','FRAGMENT',150,'{}','{}'),
  ('missing_shooter','Textbaustein · Schütze fehlt','Fallback, wenn bei Straf-Penalty oder Penaltyschießen kein Schütze erfasst wurde.','FRAGMENT',160,'{}','{}'),
  ('missing_goalie','Textbaustein · Goalie fehlt','Fallback, wenn bei einem Straf-Penalty kein Goalie erfasst wurde.','FRAGMENT',170,'{}','{}');

insert into app_modules.liveticker_output_variants(
  id,output_type_key,semantic_key,display_name,template_text,sort_order,is_active,is_default
) values
  ('87000000-0000-4000-8000-000000000001','missing_goal_scorer','normal','Normal','Torschütze offen',10,true,true),
  ('88000000-0000-4000-8000-000000000001','missing_shooter','normal','Normal','Schütze offen',10,true,true),
  ('89000000-0000-4000-8000-000000000001','missing_goalie','normal','Normal','Goalie offen',10,true,true);

commit;
