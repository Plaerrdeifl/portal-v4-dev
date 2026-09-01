const STYLE_ID = "m328RegistrationBookingUxStyle";

export function setupM328RegistrationBookingUx() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .m328-reg3-booking{transition:border-color .15s ease,box-shadow .15s ease,background .15s ease}
    .m328-reg3-booking.is-active-booking{border:3px solid var(--blue-700)!important;background:color-mix(in srgb,var(--warning) 9%,var(--surface));box-shadow:0 0 0 3px color-mix(in srgb,var(--blue-700) 16%,transparent),0 10px 24px rgba(2,18,35,.08)}
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-head{background:color-mix(in srgb,var(--warning) 15%,var(--surface));border-bottom-color:color-mix(in srgb,var(--warning) 38%,var(--line))}
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-head strong{color:var(--blue-700)}
    .m328-reg3-booking.is-decision-booking{border:2px solid color-mix(in srgb,var(--accent) 55%,var(--line))!important;background:color-mix(in srgb,var(--accent) 4%,var(--surface))}
    .m328-reg3-booking:not(.is-active-booking){background:var(--surface);cursor:default}
    .m328-reg3-booking.is-active-booking + .m328-reg3-booking{margin-top:8px}
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-booking-head{padding-top:8px;padding-bottom:8px;background:var(--surface-soft)}
    .m328-reg3-booking:not(.is-active-booking) .m328-reg3-person{display:none!important}
    .m328-reg3-booking.is-active-booking .m328-reg3-booking-overview{display:none!important}
    .m328-reg3-booking-overview{display:grid;gap:0}
    .m328-reg3-booking-overview-person{display:grid;gap:2px;width:100%;padding:8px 10px;border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;color:inherit;text-align:left;cursor:default}
    .m328-reg3-booking-overview-person:last-child{border-bottom:0}
    .m328-reg3-booking-overview-person strong{font-size:.78rem}
    .m328-reg3-booking-overview-person small{color:var(--muted);font-size:.67rem;line-height:1.35}
    .m328-reg3-booking.is-active-booking .m328-reg3-person{display:block!important;position:relative;margin:8px 10px 0;padding:0;overflow:hidden;border:1px solid var(--line)!important;border-radius:11px;background:var(--surface);cursor:pointer}
    .m328-reg3-booking.is-active-booking .m328-reg3-person:last-of-type{margin-bottom:8px}
    .m328-reg3-booking.is-active-booking .m328-reg3-person-name{display:grid;gap:2px;padding:9px 42px 3px 10px}
    .m328-reg3-booking.is-active-booking .m328-reg3-person:not(.is-editing) .m328-reg3-person-name small{display:none}
    .m328-reg3-booking.is-active-booking .m328-reg3-person:not(.is-editing)>label{display:none!important}
    .m328-reg3-booking.is-active-booking .m328-reg3-person.is-editing{cursor:default;background:color-mix(in srgb,var(--accent) 4%,var(--surface));border-color:color-mix(in srgb,var(--accent) 35%,var(--line))!important}
    .m328-reg3-booking.is-active-booking .m328-reg3-person.is-editing>label{display:grid!important;margin:0 10px 8px}
    .m328-reg3-active-person-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:0 10px 9px;color:var(--muted);font-size:.67rem;line-height:1.35}
    .m328-reg3-active-person-summary-chevron{color:var(--accent);font-size:1rem;font-weight:900;line-height:1}
    .m328-reg3-person.is-editing .m328-reg3-active-person-summary{display:none!important}
    .m328-reg3-booking.is-active-booking .m328-reg3-remove{top:7px;right:7px}
    .m328-reg3-booking-status{display:none;align-items:center;flex:0 0 auto;padding:3px 7px;border-radius:999px;background:var(--blue-700);color:#fff;font-size:.63rem;font-weight:850;line-height:1.15;white-space:nowrap}
    .m328-reg3-booking:not(.is-active-booking):not(.is-decision-booking) .m328-reg3-booking-status-prepared,.m328-reg3-booking.is-active-booking .m328-reg3-booking-status-active,.m328-reg3-booking.is-decision-booking .m328-reg3-booking-status-decision{display:inline-flex}
    .m328-reg3-booking-status-prepared{border:1px solid var(--line);background:var(--surface);color:var(--ink-500)}
    .m328-reg3-booking-status-decision{background:color-mix(in srgb,var(--accent) 70%,#6b7280)}
    .m328-reg3-booking-settings{width:28px;min-width:28px;height:28px}
    .m328-reg3-booking-menu{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;gap:5px!important;width:max-content}
    .m328-reg3-booking-menu .button{width:auto!important;flex:0 0 auto!important}
    .m328-reg3-booking-menu[hidden]{display:none!important}
    .m328-reg3-target-actions:empty,.m328-reg3-target-actions[hidden]{display:none!important}
    .m328-reg3-decision-backdrop{position:fixed;inset:0;z-index:1198;pointer-events:auto;background:rgba(2,18,35,.55);backdrop-filter:blur(2px)}
    .m328-reg3-target.is-decision-modal{position:fixed!important;left:50%;top:50%;z-index:1199;display:grid!important;width:min(460px,calc(100vw - 28px));max-height:calc(100dvh - 56px);margin:0!important;padding:18px!important;overflow:auto;transform:translate(-50%,-50%);border:1px solid var(--line);border-radius:16px;background:var(--surface)!important;box-shadow:0 24px 70px rgba(2,18,35,.28);gap:14px;align-items:stretch!important;pointer-events:auto}
    .m328-reg3-target.is-decision-modal .m328-reg3-target-copy{gap:7px}
    .m328-reg3-target.is-decision-modal .m328-reg3-target-copy strong{font-size:1rem}
    .m328-reg3-target.is-decision-modal .m328-reg3-target-copy span{font-size:.8rem;line-height:1.45}
    .m328-reg3-target.is-decision-modal .m328-reg3-target-actions{display:grid!important;grid-template-columns:1fr;gap:8px;width:100%}
    .m328-reg3-target.is-decision-modal .m328-reg3-target-action{width:100%!important;min-height:42px}
    body.m328-reg3-decision-open{overflow:hidden}
    .m328-reg3-booking-complete{display:grid;gap:5px;padding:10px;border-top:1px solid color-mix(in srgb,var(--accent) 30%,var(--line));background:color-mix(in srgb,var(--accent) 6%,var(--surface))}
    .m328-reg3-booking-complete-hint{margin:0;color:var(--muted);font-size:.67rem;line-height:1.35}
    .m328-reg3-booking-complete .m328-reg3-booking-save{width:100%!important;min-height:40px;white-space:nowrap}
    @media(max-width:520px){
      .m328-reg3-booking-head{grid-template-columns:minmax(0,1fr) auto!important;align-items:start!important}
      .m328-reg3-booking-head-copy{display:flex!important;flex-wrap:wrap!important;align-items:center!important;gap:5px 7px!important;overflow:visible!important}
      .m328-reg3-booking-head-copy>strong{flex:1 1 100%;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .m328-reg3-booking-actions{align-self:start}
      .m328-reg3-booking-overview-person{grid-template-columns:minmax(0,1fr);gap:2px}
    }
  `;
  document.head.appendChild(style);
}

export function noop() {}
