create schema if not exists app_private;

revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;

comment on schema app_private is
  'Internal server-side objects. Not exposed through the public API.';
