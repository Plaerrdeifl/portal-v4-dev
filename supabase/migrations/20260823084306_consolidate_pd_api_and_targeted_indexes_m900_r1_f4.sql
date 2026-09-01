-- Plärrdeifl Portal V4
-- P900 / M900-R1 Auftrag 4: aktueller Dispatch und gezielte Stabilisierung

begin;

-- The existing unique triple is the already-established ICS identity. DEV
-- inventory before this migration: 30 rows, zero NULL identity parts and zero
-- duplicates. Promoting that exact key does not invent a new business identity.
alter table app_modules.event_external_refs
  drop constraint event_external_refs_source_identity_key;

alter table app_modules.event_external_refs
  add constraint event_external_refs_pkey
  primary key (source_type, source_key, external_uid);

-- Current trip deletion/FK checks and booking snapshots filter bookings by
-- trip_id. No existing index has trip_id as its leading column.
create index fanbus_bookings_trip_id_idx
  on app_modules.fanbus_bookings(trip_id);

-- Canonical normalized action inventory: 29 READ and 90 USER_MUTATION actions.
-- The legacy mixed-case saveDashboardPreferences alias is preserved separately.
create function app_private.pd_api_current_actions()
returns text[]
language sql
immutable
set search_path = ''
as $function$
  select array[
      'admin_snapshot',
      'approve_request',
      'archive_task',
      'bootstrap',
      'claim_initial_admin',
      'create_finance_entry',
      'create_push_test',
      'dashboard',
      'delete_archived_task',
      'delete_contribution_class',
      'delete_contribution_season',
      'delete_finance_account',
      'delete_role',
      'delete_team',
      'event_create',
      'event_delete',
      'event_update',
      'events_list',
      'fanbus_available_events',
      'fanbus_boarding_stop_upsert',
      'fanbus_boarding_stops_list',
      'fanbus_boarding_stops_reorder',
      'fanbus_bus_assignment_set',
      'fanbus_bus_boarding_stops_list',
      'fanbus_bus_boarding_stops_set',
      'fanbus_bus_upsert',
      'fanbus_buses_list',
      'fanbus_checkin_set',
      'fanbus_companion_booking_submit',
      'fanbus_companion_duplicate_preview',
      'fanbus_companion_list_delete',
      'fanbus_companion_list_upsert',
      'fanbus_companion_lists_list',
      'fanbus_companion_member_delete',
      'fanbus_companion_member_upsert',
      'fanbus_companion_members_reorder',
      'fanbus_companion_person_link',
      'fanbus_companion_person_search',
      'fanbus_companion_person_unlink',
      'fanbus_operations_snapshot',
      'fanbus_paid_set',
      'fanbus_registration_cancel',
      'fanbus_registration_create_manual',
      'fanbus_registration_identity_link',
      'fanbus_registration_identity_relink',
      'fanbus_registration_identity_search',
      'fanbus_registration_identity_suggestion',
      'fanbus_registration_identity_unlink',
      'fanbus_registration_operational_detail',
      'fanbus_registration_operational_update',
      'fanbus_registration_people_list',
      'fanbus_registration_update',
      'fanbus_registration_update_m325',
      'fanbus_registrations_list',
      'fanbus_self_register',
      'fanbus_trip_boarding_stop_upsert',
      'fanbus_trip_boarding_stops_list',
      'fanbus_trip_boarding_stops_public',
      'fanbus_trip_boarding_stops_reorder',
      'fanbus_trip_cancel',
      'fanbus_trip_close',
      'fanbus_trip_create',
      'fanbus_trip_delete',
      'fanbus_trip_publish',
      'fanbus_trip_reopen',
      'fanbus_trip_update',
      'fanbus_trips_list',
      'fanbus_user_preference_delete',
      'fanbus_user_preference_get',
      'fanbus_user_preference_set',
      'fanbus_waitlist_promote',
      'fanclub_snapshot',
      'mark_notification_read',
      'member_detail',
      'member_match',
      'member_portal_link',
      'member_portal_unlink',
      'membership_application_convert',
      'membership_application_detail',
      'membership_application_manual_decide',
      'membership_application_vote',
      'membership_application_withdraw',
      'membership_applications_list',
      'push_snapshot',
      'reject_request',
      'remove_member_contribution',
      'remove_push_subscription',
      'remove_team_member',
      'report_contribution_payment',
      'restore_task',
      'reverse_finance_entry',
      'review_contribution_payment',
      'review_profile_change_request',
      'save_contribution_class',
      'save_contribution_season',
      'save_finance_account',
      'save_member',
      'save_member_contribution',
      'save_notification_preferences',
      'save_offices',
      'save_push_subscription',
      'save_role',
      'save_task',
      'save_task_note',
      'save_team',
      'save_team_member',
      'save_user',
      'save_user_task_access',
      'set_role_capabilities',
      'set_task_status',
      'set_team_functions',
      'set_user_capabilities',
      'submit_access_request',
      'submit_profile_change_request',
      'task_transfer',
      'tasks_snapshot',
      'teams_snapshot',
      'transfer_finance',
      'update_profile'
    ]::text[];
$function$;

-- Direct dispatcher to the final current domain functions. It deliberately
-- returns data only; public.pd_api owns authentication, Platform Mode and the
-- established ok/data/error envelope.
create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_data jsonb;
  v_trip_id uuid;
begin
  -- This compatibility alias has always been case-sensitive and is not an
  -- additional normalized action.
  if p_action = 'saveDashboardPreferences' then
    return app_private.api_save_dashboard_preferences(v_payload);
  end if;

  -- Preserve dashboard widget enrichment and its exact spelling condition.
  if v_action = 'dashboard' then
    v_data := app_private.api_dashboard();
    if p_action = 'dashboard' then
      v_data := pg_catalog.jsonb_set(
        v_data,
        '{preferences}',
        app_private.api_dashboard_preferences(),
        true
      );
    end if;
    return v_data;
  end if;

  -- Preserve the authenticated portal projection over the reviewed public
  -- boarding-stop RPC without routing through the P800/M330 wrappers.
  if v_action = 'fanbus_trip_boarding_stops_public' then
    perform app_private.require_active_user();
    begin
      v_trip_id := nullif(
        pg_catalog.btrim(coalesce(v_payload ->> 'tripId', '')),
        ''
      )::uuid;
    exception when others then
      raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD'
        using errcode = '22023';
    end;
    if v_trip_id is null then
      raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD'
        using errcode = '22023';
    end if;
    return public.pd_public_fanbus_trip_boarding_stops(v_trip_id);
  end if;

  case v_action
    when 'admin_snapshot' then
      return app_private.api_admin_snapshot();
    when 'approve_request' then
      return app_private.api_approve_request(v_payload);
    when 'archive_task' then
      return app_private.api_archive_task(v_payload);
    when 'bootstrap' then
      return app_private.api_bootstrap();
    when 'claim_initial_admin' then
      return app_private.api_claim_initial_admin(v_payload);
    when 'create_finance_entry' then
      return app_private.api_create_finance_entry(v_payload);
    when 'create_push_test' then
      return app_private.api_create_push_test();
    when 'delete_archived_task' then
      return app_private.api_delete_archived_task(v_payload);
    when 'delete_contribution_class' then
      return app_private.api_delete_contribution_class(v_payload);
    when 'delete_contribution_season' then
      return app_private.api_delete_contribution_season(v_payload);
    when 'delete_finance_account' then
      return app_private.api_delete_finance_account(v_payload);
    when 'delete_role' then
      return app_private.api_delete_role(v_payload);
    when 'delete_team' then
      return app_private.api_delete_team(v_payload);
    when 'event_create' then
      return app_private.api_event_create(v_payload);
    when 'event_delete' then
      return app_private.api_event_delete(v_payload);
    when 'event_update' then
      return app_private.api_event_update(v_payload);
    when 'events_list' then
      return app_private.api_events_list();
    when 'fanbus_available_events' then
      return app_private.api_fanbus_available_events();
    when 'fanbus_boarding_stop_upsert' then
      return app_private.api_fanbus_boarding_stop_upsert(v_payload);
    when 'fanbus_boarding_stops_list' then
      return app_private.api_fanbus_boarding_stops_list();
    when 'fanbus_boarding_stops_reorder' then
      return app_private.api_fanbus_boarding_stops_reorder(v_payload);
    when 'fanbus_bus_assignment_set' then
      return app_private.api_fanbus_bus_assignment_set(v_payload);
    when 'fanbus_bus_boarding_stops_list' then
      return app_private.api_fanbus_bus_boarding_stops_list(v_payload);
    when 'fanbus_bus_boarding_stops_set' then
      return app_private.api_fanbus_bus_boarding_stops_set(v_payload);
    when 'fanbus_bus_upsert' then
      return app_private.api_fanbus_bus_upsert(v_payload);
    when 'fanbus_buses_list' then
      return app_private.api_fanbus_buses_list(v_payload);
    when 'fanbus_checkin_set' then
      return app_private.api_fanbus_checkin_set(v_payload);
    when 'fanbus_companion_booking_submit' then
      return app_private.api_fanbus_companion_booking_submit(v_payload);
    when 'fanbus_companion_duplicate_preview' then
      return app_private.api_fanbus_companion_duplicate_preview(v_payload);
    when 'fanbus_companion_list_delete' then
      return app_private.api_fanbus_companion_list_delete(v_payload);
    when 'fanbus_companion_list_upsert' then
      return app_private.api_fanbus_companion_list_upsert(v_payload);
    when 'fanbus_companion_lists_list' then
      return app_private.api_fanbus_companion_lists_list();
    when 'fanbus_companion_member_delete' then
      return app_private.api_fanbus_companion_member_delete(v_payload);
    when 'fanbus_companion_member_upsert' then
      return app_private.api_fanbus_companion_member_upsert(v_payload);
    when 'fanbus_companion_members_reorder' then
      return app_private.api_fanbus_companion_members_reorder(v_payload);
    when 'fanbus_companion_person_link' then
      return app_private.api_fanbus_companion_person_link(v_payload);
    when 'fanbus_companion_person_search' then
      return app_private.api_fanbus_companion_person_search(v_payload);
    when 'fanbus_companion_person_unlink' then
      return app_private.api_fanbus_companion_person_unlink(v_payload);
    when 'fanbus_operations_snapshot' then
      return app_private.api_fanbus_operations_snapshot(v_payload);
    when 'fanbus_paid_set' then
      return app_private.api_fanbus_paid_set(v_payload);
    when 'fanbus_registration_cancel' then
      return app_private.api_fanbus_registration_cancel(v_payload);
    when 'fanbus_registration_create_manual' then
      return app_private.api_fanbus_registration_create_manual(v_payload);
    when 'fanbus_registration_identity_link' then
      return app_private.api_fanbus_registration_identity_link(v_payload);
    when 'fanbus_registration_identity_relink' then
      return app_private.api_fanbus_registration_identity_relink(v_payload);
    when 'fanbus_registration_identity_search' then
      return app_private.api_fanbus_registration_identity_search(v_payload);
    when 'fanbus_registration_identity_suggestion' then
      return app_private.api_fanbus_registration_identity_suggestion(v_payload);
    when 'fanbus_registration_identity_unlink' then
      return app_private.api_fanbus_registration_identity_unlink(v_payload);
    when 'fanbus_registration_operational_detail' then
      return app_private.api_fanbus_registration_operational_detail(v_payload);
    when 'fanbus_registration_operational_update' then
      return app_private.api_fanbus_registration_operational_update(v_payload);
    when 'fanbus_registration_people_list' then
      return app_private.api_fanbus_registration_people_list();
    when 'fanbus_registration_update' then
      return app_private.api_fanbus_registration_update(v_payload);
    when 'fanbus_registration_update_m325' then
      return app_private.api_fanbus_registration_update_m325(v_payload);
    when 'fanbus_registrations_list' then
      return app_private.api_fanbus_registrations_list(v_payload);
    when 'fanbus_self_register' then
      return app_private.api_fanbus_self_register(v_payload);
    when 'fanbus_trip_boarding_stop_upsert' then
      return app_private.api_fanbus_trip_boarding_stop_upsert(v_payload);
    when 'fanbus_trip_boarding_stops_list' then
      return app_private.api_fanbus_trip_boarding_stops_list(v_payload);
    when 'fanbus_trip_boarding_stops_reorder' then
      return app_private.api_fanbus_trip_boarding_stops_reorder(v_payload);
    when 'fanbus_trip_cancel' then
      return app_private.api_fanbus_trip_cancel(v_payload);
    when 'fanbus_trip_close' then
      return app_private.api_fanbus_trip_close(v_payload);
    when 'fanbus_trip_create' then
      return app_private.api_fanbus_trip_create(v_payload);
    when 'fanbus_trip_delete' then
      return app_private.api_fanbus_trip_delete(v_payload);
    when 'fanbus_trip_publish' then
      return app_private.api_fanbus_trip_publish(v_payload);
    when 'fanbus_trip_reopen' then
      return app_private.api_fanbus_trip_reopen(v_payload);
    when 'fanbus_trip_update' then
      return app_private.api_fanbus_trip_update(v_payload);
    when 'fanbus_trips_list' then
      return app_private.api_fanbus_trips_list();
    when 'fanbus_user_preference_delete' then
      return app_private.api_fanbus_user_preference_delete(v_payload);
    when 'fanbus_user_preference_get' then
      return app_private.api_fanbus_user_preference_get(v_payload);
    when 'fanbus_user_preference_set' then
      return app_private.api_fanbus_user_preference_set(v_payload);
    when 'fanbus_waitlist_promote' then
      return app_private.api_fanbus_waitlist_promote(v_payload);
    when 'fanclub_snapshot' then
      return app_private.api_fanclub_snapshot();
    when 'mark_notification_read' then
      return app_private.api_mark_notification_read(v_payload);
    when 'member_detail' then
      return app_private.api_member_detail(v_payload);
    when 'member_match' then
      return app_private.api_member_match(v_payload);
    when 'member_portal_link' then
      return app_private.api_member_portal_link(v_payload);
    when 'member_portal_unlink' then
      return app_private.api_member_portal_unlink(v_payload);
    when 'membership_application_convert' then
      return app_private.api_membership_application_convert(v_payload);
    when 'membership_application_detail' then
      return app_private.api_membership_application_detail(v_payload);
    when 'membership_application_manual_decide' then
      return app_private.api_membership_application_manual_decide(v_payload);
    when 'membership_application_vote' then
      return app_private.api_membership_application_vote(v_payload);
    when 'membership_application_withdraw' then
      return app_private.api_membership_application_withdraw(v_payload);
    when 'membership_applications_list' then
      return app_private.api_membership_applications_list();
    when 'push_snapshot' then
      return app_private.api_push_snapshot();
    when 'reject_request' then
      return app_private.api_reject_request(v_payload);
    when 'remove_member_contribution' then
      return app_private.api_remove_member_contribution(v_payload);
    when 'remove_push_subscription' then
      return app_private.api_remove_push_subscription(v_payload);
    when 'remove_team_member' then
      return app_private.api_remove_team_member(v_payload);
    when 'report_contribution_payment' then
      return app_private.api_report_contribution_payment(v_payload);
    when 'restore_task' then
      return app_private.api_restore_task(v_payload);
    when 'reverse_finance_entry' then
      return app_private.api_reverse_finance_entry(v_payload);
    when 'review_contribution_payment' then
      return app_private.api_review_contribution_payment(v_payload);
    when 'review_profile_change_request' then
      return app_private.api_review_profile_change_request(v_payload);
    when 'save_contribution_class' then
      return app_private.api_save_contribution_class(v_payload);
    when 'save_contribution_season' then
      return app_private.api_save_contribution_season(v_payload);
    when 'save_finance_account' then
      return app_private.api_save_finance_account(v_payload);
    when 'save_member' then
      return app_private.api_save_member(v_payload);
    when 'save_member_contribution' then
      return app_private.api_save_member_contribution(v_payload);
    when 'save_notification_preferences' then
      return app_private.api_save_notification_preferences(v_payload);
    when 'save_offices' then
      return app_private.api_save_offices(v_payload);
    when 'save_push_subscription' then
      return app_private.api_save_push_subscription(v_payload);
    when 'save_role' then
      return app_private.api_save_role(v_payload);
    when 'save_task' then
      return app_private.api_save_task(v_payload);
    when 'save_task_note' then
      return app_private.api_save_task_note(v_payload);
    when 'save_team' then
      return app_private.api_save_team(v_payload);
    when 'save_team_member' then
      return app_private.api_save_team_member(v_payload);
    when 'save_user' then
      return app_private.api_save_user(v_payload);
    when 'save_user_task_access' then
      return app_private.api_save_user_task_access(v_payload);
    when 'set_role_capabilities' then
      return app_private.api_set_role_capabilities(v_payload);
    when 'set_task_status' then
      return app_private.api_set_task_status(v_payload);
    when 'set_team_functions' then
      return app_private.api_set_team_functions(v_payload);
    when 'set_user_capabilities' then
      return app_private.api_set_user_capabilities(v_payload);
    when 'submit_access_request' then
      return app_private.api_submit_access_request(v_payload);
    when 'submit_profile_change_request' then
      return app_private.api_submit_profile_change_request(v_payload);
    when 'task_transfer' then
      return app_private.api_task_transfer(v_payload);
    when 'tasks_snapshot' then
      return app_private.api_tasks_snapshot();
    when 'teams_snapshot' then
      return app_private.api_teams_snapshot();
    when 'transfer_finance' then
      return app_private.api_transfer_finance(v_payload);
    when 'update_profile' then
      return app_private.api_update_profile(v_payload);
    else
      raise exception 'Unbekannte Portalaktion: %', v_action
        using errcode = '22023';
  end case;
end;
$function$;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_data jsonb;
  v_error_code text;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if app_private.platform_action_classification(v_action) = 'USER_MUTATION' then
    perform app_private.require_platform_user_write_allowed(
      v_action,
      auth.uid()
    );
  end if;

  v_data := app_private.pd_api_dispatch_current(p_action, p_payload);

  return pg_catalog.jsonb_build_object('ok', true, 'data', v_data);
exception when others then
  v_error_code := case sqlstate
    when 'P0901' then 'PLATFORM_WRITE_UNAVAILABLE'
    when 'P0902' then 'PLATFORM_READ_ONLY'
    when 'P0903' then 'PLATFORM_MAINTENANCE'
    else sqlstate
  end;
  return pg_catalog.jsonb_build_object(
    'ok', false,
    'error', pg_catalog.jsonb_build_object(
      'code', v_error_code,
      'message', sqlerrm
    )
  );
end;
$function$;

revoke all on function
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.pd_api(text, jsonb)
to authenticated;

-- Historical routers remain for forensic comparison, but none participates in
-- the active path or has a client/service_role grant.
revoke all on function
  public.pd_api_before_events_r1(text, jsonb),
  public.pd_api_before_fanbus_cancellation_m330_r1(text, jsonb),
  public.pd_api_before_fanbus_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_manual_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_open_on_publish_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_operations_m325_r1(text, jsonb),
  public.pd_api_before_fanbus_participants_m320_r1(text, jsonb),
  public.pd_api_before_fanbus_registration_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_reopen_m310_r1(text, jsonb),
  public.pd_api_before_joint_f1(text, jsonb),
  public.pd_api_before_m010_r1(text, jsonb),
  public.pd_api_before_m010_r2_team_functions(text, jsonb),
  public.pd_api_before_m325_r2_member_linking(text, jsonb),
  public.pd_api_before_member_detail(text, jsonb),
  public.pd_api_before_membership_access_m150_r2(text, jsonb),
  public.pd_api_before_membership_application_conversion_r1(text, jsonb),
  public.pd_api_before_membership_application_withdraw_r1(text, jsonb),
  public.pd_api_before_membership_applications_r1(text, jsonb),
  public.pd_api_before_p800_u5_r1(text, jsonb),
  public.pd_api_before_phase2_finalization(text, jsonb),
  public.pd_api_before_phase2_sorting(text, jsonb),
  public.pd_api_before_platform_mode_m900_r1(text, jsonb),
  public.pd_api_before_task_access_push_r3(text, jsonb),
  public.pd_api_before_task_workflow_r2(text, jsonb),
  public.pd_api_before_user_task_access_r1(text, jsonb),
  public.pd_api_before_web_push_r1(text, jsonb),
  public.pd_api_core_before_dashboard_widgets_r1(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_api_before_events_r1(text, jsonb),
  public.pd_api_before_fanbus_cancellation_m330_r1(text, jsonb),
  public.pd_api_before_fanbus_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_manual_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_open_on_publish_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_operations_m325_r1(text, jsonb),
  public.pd_api_before_fanbus_participants_m320_r1(text, jsonb),
  public.pd_api_before_fanbus_registration_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_reopen_m310_r1(text, jsonb),
  public.pd_api_before_joint_f1(text, jsonb),
  public.pd_api_before_m010_r1(text, jsonb),
  public.pd_api_before_m010_r2_team_functions(text, jsonb),
  public.pd_api_before_m325_r2_member_linking(text, jsonb),
  public.pd_api_before_member_detail(text, jsonb),
  public.pd_api_before_membership_access_m150_r2(text, jsonb),
  public.pd_api_before_membership_application_conversion_r1(text, jsonb),
  public.pd_api_before_membership_application_withdraw_r1(text, jsonb),
  public.pd_api_before_membership_applications_r1(text, jsonb),
  public.pd_api_before_p800_u5_r1(text, jsonb),
  public.pd_api_before_phase2_finalization(text, jsonb),
  public.pd_api_before_phase2_sorting(text, jsonb),
  public.pd_api_before_platform_mode_m900_r1(text, jsonb),
  public.pd_api_before_task_access_push_r3(text, jsonb),
  public.pd_api_before_task_workflow_r2(text, jsonb),
  public.pd_api_before_user_task_access_r1(text, jsonb),
  public.pd_api_before_web_push_r1(text, jsonb),
  public.pd_api_core_before_dashboard_widgets_r1(text, jsonb)
to postgres;

comment on function app_private.pd_api_current_actions() is
  'M900-R1 F4 canonical inventory of 29 READ and 90 USER_MUTATION actions.';
comment on function app_private.pd_api_dispatch_current(text, jsonb) is
  'M900-R1 F4 direct compatible dispatch to current domain functions.';
comment on function public.pd_api(text, jsonb) is
  'Authenticated boundary: auth, Platform Mode guard, current dispatcher and stable envelope.';
comment on index app_modules.fanbus_bookings_trip_id_idx is
  'M900-R1 F4 supports trip-scoped booking reads and trip FK delete checks.';

commit;
