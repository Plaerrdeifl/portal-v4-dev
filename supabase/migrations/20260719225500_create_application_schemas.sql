create schema if not exists app_portal;
create schema if not exists app_fanclub;
create schema if not exists app_modules;

comment on schema app_portal is
  'Portal identity, roles, permissions, teams, settings, and audit data.';

comment on schema app_fanclub is
  'Fan club members, offices, contributions, accounts, and financial data.';

comment on schema app_modules is
  'Independent portal modules such as tasks and future functional modules.';

revoke all on schema app_portal from public;
revoke all on schema app_portal from anon;
revoke all on schema app_portal from authenticated;

revoke all on schema app_fanclub from public;
revoke all on schema app_fanclub from anon;
revoke all on schema app_fanclub from authenticated;

revoke all on schema app_modules from public;
revoke all on schema app_modules from anon;
revoke all on schema app_modules from authenticated;

revoke all on all tables in schema app_portal
  from public, anon, authenticated;
revoke all on all sequences in schema app_portal
  from public, anon, authenticated;
revoke all on all functions in schema app_portal
  from public, anon, authenticated;

revoke all on all tables in schema app_fanclub
  from public, anon, authenticated;
revoke all on all sequences in schema app_fanclub
  from public, anon, authenticated;
revoke all on all functions in schema app_fanclub
  from public, anon, authenticated;

revoke all on all tables in schema app_modules
  from public, anon, authenticated;
revoke all on all sequences in schema app_modules
  from public, anon, authenticated;
revoke all on all functions in schema app_modules
  from public, anon, authenticated;

alter default privileges in schema app_portal
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema app_portal
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app_portal
  revoke all on functions from public, anon, authenticated;

alter default privileges in schema app_fanclub
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema app_fanclub
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app_fanclub
  revoke all on functions from public, anon, authenticated;

alter default privileges in schema app_modules
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema app_modules
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app_modules
  revoke all on functions from public, anon, authenticated;
