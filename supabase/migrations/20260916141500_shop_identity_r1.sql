-- Plärrdeifl Portal V4 / Shop identity R1
-- Minimal authenticated identity projection for WordPress/WooCommerce.
-- Deliberately returns no PII; PUBLIC remains the unauthenticated WordPress default.

create or replace function public.pd_shop_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_member_id uuid := null;
begin
  select member.id
  into v_member_id
  from app_portal.user_member_links as link
  join app_fanclub.members as member
    on member.id = link.member_id
   and member.status = 'ACTIVE'
  where link.user_id = v_actor;

  return jsonb_build_object(
    'portalUserId', v_actor,
    'customerClass', case
      when v_member_id is null then 'PORTAL'
      else 'MEMBER'
    end,
    'memberId', v_member_id
  );
end;
$$;

revoke all on function public.pd_shop_identity() from public, anon;
grant execute on function public.pd_shop_identity() to authenticated;
