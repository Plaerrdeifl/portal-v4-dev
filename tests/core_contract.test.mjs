import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("V4 entry point uses Supabase and no active Apps Script bridge", async () => {
  const html = await read("index.html");
  assert.match(html, /@supabase\/supabase-js@2/);
  assert.match(html, /js\/runtime-config\.js/);
  assert.match(html, /type="module" src="\.\/js\/app\.js/);
  assert.doesNotMatch(html, /<script[^>]+google-identity\.js/i);
  assert.doesNotMatch(html, /<script[^>]+m4-corr/i);
  assert.doesNotMatch(html, /script\.google\.com\/macros/i);
});

test("runtime configuration is generated and ignored", async () => {
  const ignore = await read(".gitignore");
  const example = await read("js/runtime-config.example.js");
  const generator = await read("scripts/write-runtime-config.mjs");
  assert.match(ignore, /^\/js\/runtime-config\.js$/m);
  assert.match(example, /supabasePublishableKey/);
  assert.match(generator, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(generator, /service[_-]?role/i);
});

test("database migrations are ordered and contain the core contract", async () => {
  const names = (await readdir(join(root, "supabase", "migrations")))
    .filter(name => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(names, [
    "20260717182508_bootstrap_private_schema.sql",
    "20260719225500_create_application_schemas.sql",
    "20260719230000_create_portal_core_tables.sql",
    "20260719230100_seed_portal_core_authorization.sql",
    "20260719230200_create_portal_core_api.sql",
    "20260720152000_add_member_email_match_suggestion.sql",
    "20260720161000_add_admin_team_delete.sql",
    "20260720174500_make_team_codes_internal.sql",
    "20260720201500_harden_task_workflow.sql",
    "20260720223000_restore_archived_tasks.sql",
    "20260720234500_add_contribution_management.sql",
    "20260721013000_add_finance_task_profile_workflows.sql",
    "20260721095000_add_finance_account_opening_balance.sql",
    "20260721193000_finalize_fanclub_review.sql",
    "20260722113000_add_fanclub_sort_positions.sql",
    "20260722143000_finalize_fanclub_phase2.sql",
    "20260722190000_finalize_portal_phase2_acceptance.sql",
    "20260722213000_compact_workflows_and_account_retirement.sql",
    "20260722220000_fix_account_retirement_snapshot_actor.sql",
    "20260723162000_add_task_history.sql",
    "20260723190000_add_task_workflow_r2_core.sql",
    "20260723213000_add_web_push_r1.sql",
    "20260723234500_fix_web_push_badge_and_quiet_time.sql",
    "20260723235500_add_task_created_push_r1.sql",
    "20260724000500_fix_task_access_immediate_transfer_and_push_deeplinks.sql",
    "20260724113000_add_admin_task_access_overrides.sql",
    "20260724133000_add_role_aware_dashboard_r1.sql",
    "20260724193000_add_personal_dashboard_widgets_r1.sql",
    "20260725010000_add_dashboard_small_widget_size_r1.sql",
    "20260727203211_harden_private_function_privileges_and_push_runtime.sql",
    "20260802211306_harden_pd_api_revoke_anon_execute.sql",
    "20260807120000_harden_public_default_privileges.sql",
    "20260807120100_add_central_event_model_r1.sql",
    "20260808120000_add_internal_events_api_r1.sql",
    "20260808130000_add_public_events_read_api_r1.sql",
    "20260808140000_repair_birth_date_baseline_bf_003.sql",
    "20260808150000_add_membership_application_model_r1.sql",
    "20260808151000_add_membership_application_internal_api_r1.sql",
    "20260809001000_add_membership_application_conversion_r1.sql",
    "20260809002000_add_membership_application_conversion_api_r1.sql",
    "20260809094500_add_membership_application_public_intake_model_r1.sql",
    "20260809095000_add_membership_application_public_intake_api_r1.sql",
    "20260809143000_add_m150_membership_communication_core_r1.sql",
    "20260809190000_add_m150_membership_retention_r1.sql",
    "20260810080000_add_m150_membership_application_withdraw_r1.sql",
    "20260810140000_add_central_user_capabilities_m010_r1.sql",
    "20260810174420_add_fanbus_core_m310_r1.sql",
    "20260810181918_add_internal_fanbus_api_m310_r1.sql",
    "20260810194738_add_public_fanbus_registration_m310_r1.sql",
    "20260810203931_add_public_fanbus_list_m310_r1.sql",
    "20260811123652_add_m210_ics_import_r2.sql",
    "20260811150000_add_manual_fanbus_registrations_m310_r1.sql",
    "20260812191937_add_fanbus_reopen_m310_r1.sql",
    "20260812223000_open_fanbus_registration_on_publish_m310_r1.sql",
    "20260814110000_add_fanbus_participants_m320_r1.sql",
    "20260814130000_add_fanbus_operations_m325_r1.sql",
    "20260815120000_fix_m325_f5_capacity_and_ui_contract.sql",
    "20260815214000_p800_u5_fanbus_paid_marker.sql",
    "20260815223000_p800_u5_1_remove_departure_info_requirement.sql",
    "20260816125838_harden_fanbus_m325_idempotency_rls.sql",
    "20260816170000_add_central_notifications_m020_r1.sql",
    "20260817183000_add_notification_preferences_m020_r2.sql",
    "20260818194500_add_fanbus_trip_cancellation_m330_r1.sql",
    "20260818194600_add_fanbus_change_notifications_m330_r1.sql",
    "20260819151000_add_membership_portal_identity_m150_r2.sql",
    "20260820065000_add_team_function_authorization_m010_r2.sql",
    "20260820070000_split_fanbus_operations_permissions_m010_r2.sql",
    "20260820071500_adjust_fanbus_read_permissions_m010_r2.sql",
    "20260820073000_retire_member_role_m010_r2.sql",
    "20260820074500_manage_team_functions_m010_r2.sql",
    "20260820080000_dynamic_fanbus_org_recipients_m010_r2.sql",
    "20260820120000_add_m325_r2_member_linking.sql",
    "20260822074900_add_joint_fanbus_preferences_and_bus_control.sql",
    "20260823002244_add_platform_mode_core_m900_r1.sql",
    "20260823004248_harden_platform_mode_user_boundaries_m900_r1.sql",
    "20260823073847_harden_security_boundaries_m900_r1.sql",
    "20260823084306_consolidate_pd_api_and_targeted_indexes_m900_r1_f4.sql",
    "20260823154611_harden_release_bypass_strict_user_bound_m900_r1.sql",
    "20260823202816_m020_push_subscription_lifecycle_hotfix.sql",
    "20260824044603_m020_access_request_actor_projection_hotfix.sql",
    "20260824222500_m020_access_request_badge_actionability_hotfix.sql",
    "20260826200358_p800_r2_fanbus_available_away_events_polish4.sql",
    "20260827063627_m326_r1_f1_f2_people_groups_identity.sql",
    "20260827063630_m326_r1_f3_manual_bulk.sql",
    "20260827063633_m326_r1_f4_mail_label.sql",
    "20260827083330_m326_r1_f45_review_corrections.sql",
    "20260827184505_hotfix_member_list_for_active_members.sql",
    "20260827195421_hotfix_fanbus_org_admin_push_recipient.sql",
    "20260827203217_m320_r3_auto_bus_assignment.sql",
    "20260827203255_m320_r3_planner_greatest_fix.sql",
    "20260827223113_m326_person_default_boarding_stop.sql",
    "20260828052514_m326_manual_booking_modes.sql",
    "20260828140655_fanbus_user_default_bus_preference.sql",
    "20260828161808_m326_manual_registration_before_public_open.sql",
    "20260828194202_m327_r1_fanbus_booking_selfservice.sql",
    "20260829090000_m328_r1_booking_management.sql",
    "20260829162000_m328_r1_regular_rider_reactivate.sql",
    "20260829213946_m328_completion_public_trips_dev_booking_numbers.sql",
    "20260829225223_m328_fanbus_draft_defaults.sql",
    "20260830083113_m020_push_read_outbox_compat.sql",
    "20260830172000_m327_boarding_stop_public_details.sql",
    "20260830214500_m328_booking_mail_contact_context.sql",
    "20260830223000_m328_booking_contact_receipt_correction.sql",
    "20260830223500_m328_restore_verified_whatsapp_contact.sql",
    "20260830230000_m020_fanbus_d073_acknowledge_r6.sql",
    "20260901220000_m020_push_navigation_badge_acknowledgement.sql",
    "20260905123213_fanbus_group_duplicate_review_r1.sql",
    "20260905123644_fanbus_duplicate_review_indexes_r1.sql",
    "20260905200648_liveticker_prod_r1.sql",
    "20260905200938_liveticker_prod_rosters_r1.sql",
    "20260906115000_liveticker_output_templates_prod_r1.sql",
    "20260906163500_liveticker_context_titles_prod_hotfix.sql",
    "20260906221000_liveticker_team_assets_prod_hotfix.sql",
    "20260907185126_liveticker_graphics_jobs_prod_r1.sql",
    "20260907185214_liveticker_graphics_worker_gateway_hardening_prod_r1.sql",
    "20260907185726_liveticker_graphics_portal_api_prod_r1.sql",
    "20260907190134_liveticker_graphics_completed_games_prod_hotfix.sql",
    "20260907190513_liveticker_graphics_portal_rpc_hardening_prod_r1.sql",
    "20260907191301_liveticker_graphics_game_order_prod_hotfix.sql",
    "20260907195752_liveticker_graphics_share_links_prod_r1.sql",
    "20260907202059_liveticker_graphics_games_minute_prod_hotfix.sql"
  ]);

  const tables = await read(`supabase/migrations/${names[2]}`);
  const seed = await read(`supabase/migrations/${names[3]}`);
  const api = await read(`supabase/migrations/${names[4]}`);
  const pdApiAnonHardening = await read(
    "supabase/migrations/20260802211306_harden_pd_api_revoke_anon_execute.sql"
  );
  const publicDefaultPrivileges = await read(
    "supabase/migrations/20260807120000_harden_public_default_privileges.sql"
  );
  for (const schema of ["app_portal", "app_fanclub", "app_modules", "app_private"]) {
    assert.match(tables + api, new RegExp(schema.replace("_", "_")));
  }
  assert.match(tables, /enable row level security/g);
  assert.match(seed, /VORSTAND_1/);
  assert.match(seed, /SCHRIFTFUEHRER/);
  assert.match(seed, /PORTAL_USER/);
  assert.match(api, /create or replace function public\.pd_api/);
  assert.match(api, /grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
  assert.match(api, /grant execute on function public\.pd_create_bootstrap_token[\s\S]+to service_role/);
  assert.doesNotMatch(api, /grant\s+(?:all|select|insert|update|delete)[\s\S]+to\s+anon/i);
  assert.match(
    pdApiAnonHardening,
    /revoke\s+execute\s+on\s+function\s+public\.pd_api\(text,\s*jsonb\)\s+from\s+anon\s*;/i
  );
  assert.match(
    publicDefaultPrivileges,
    /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+revoke\s+execute\s+on\s+functions\s+from\s+public\s*;/i
  );
  assert.match(
    publicDefaultPrivileges,
    /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public\s+revoke\s+all\s+on\s+tables\s+from\s+anon\s*,\s*authenticated\s*,\s*service_role\s*;/i
  );
  assert.match(
    publicDefaultPrivileges,
    /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public\s+revoke\s+all\s+on\s+sequences\s+from\s+anon\s*,\s*authenticated\s*,\s*service_role\s*;/i
  );
  assert.match(
    publicDefaultPrivileges,
    /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public\s+revoke\s+all\s+on\s+functions\s+from\s+anon\s*,\s*authenticated\s*,\s*service_role\s*;/i
  );
});

test("M900-R1 centralizes the fail-closed platform mode contract", async () => {
  const migration = await read(
    "supabase/migrations/20260823002244_add_platform_mode_core_m900_r1.sql"
  );
  const sqlTest = await read("supabase/tests/m900_platform_mode_core.sql");
  const readAllowlist = migration.match(
    /platform_action_classification[\s\S]+?= any \(array\[([\s\S]+?)\]::text\[\]\)/
  );

  assert.ok(readAllowlist);
  assert.equal([...readAllowlist[1].matchAll(/'([^']+)'/g)].length, 29);
  assert.match(migration, /insert into app_portal\.settings[\s\S]+?'platform\.mode'/);
  assert.match(migration, /create function app_private\.platform_runtime_state\(\)/);
  assert.match(migration, /create function app_private\.require_platform_user_write_allowed\(\)/);
  assert.match(migration, /create function public\.pd_public_platform_status\(\)/);
  assert.match(migration, /rename to pd_api_before_platform_mode_m900_r1/);
  assert.match(migration, /else 'USER_MUTATION'::text/);
  assert.match(migration, /PLATFORM_WRITE_UNAVAILABLE/);
  assert.match(migration, /PLATFORM_READ_ONLY/);
  assert.match(migration, /PLATFORM_MAINTENANCE/);
  assert.doesNotMatch(migration, /execute\s+format|\bexecute\s+v_/i);
  assert.match(
    migration,
    /grant execute on function public\.pd_public_platform_status\(\)\s+to anon, authenticated;/
  );
  assert.match(
    migration,
    /grant execute on function public\.pd_api\(text, jsonb\)\s+to authenticated;/
  );
  for (const requiredCase of [
    "NORMAL",
    "READ_ONLY",
    "MAINTENANCE",
    "Fehlendes Setting",
    "Fehlender mode",
    "Unbekannter mode",
    "Ungueltige Struktur",
    "Public-Status-Vertrag"
  ]) {
    assert.ok(sqlTest.includes(requiredCase), `SQL-Vertragstest fehlt: ${requiredCase}`);
  }
});
