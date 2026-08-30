const M327_COMPANION_LISTS_STYLE_ID = "m327-companion-lists-polish-style";

export function setupM327CompanionListsPolish() {
  if (typeof document === "undefined") return;
  if (document.getElementById(M327_COMPANION_LISTS_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = M327_COMPANION_LISTS_STYLE_ID;
  style.textContent = `
    @media(max-width:700px){
      .v4-m325-companion-workspace{
        gap:8px;
      }
      .v4-m325-companion-workspace > .v4-m325-workspace-header{
        align-items:flex-start;
        gap:8px;
      }
      .v4-m325-companion-workspace > .v4-m325-workspace-header > .button{
        flex:0 0 auto;
        width:auto!important;
        min-height:36px;
        padding:6px 9px;
        margin:0;
        font-size:.78rem;
        line-height:1.05;
      }
      .v4-m325-companion-workspace > .v4-m325-workspace-header h2{
        margin:0;
        font-size:1.08rem;
        line-height:1.08;
      }
      .v4-m325-companion-workspace > .v4-m325-workspace-header p{
        margin:3px 0 0;
        font-size:.76rem;
        line-height:1.27;
      }
      .v4-m325-companion-workspace .v4-m325-workspace-section{
        gap:6px;
      }
      .v4-m325-companion-workspace .v4-m325-workspace-section > h3{
        font-size:.98rem;
        line-height:1.12;
      }
      .v4-m325-companion-workspace .v4-m325-list-card{
        gap:6px;
        padding:9px!important;
        border-radius:13px;
      }
      .v4-m325-companion-workspace .v4-m325-record-copy{
        gap:2px;
      }
      .v4-m325-companion-workspace .v4-m325-record-copy > strong,
      .v4-m325-companion-workspace .v4-m325-person-title > strong{
        font-size:.91rem;
        line-height:1.13;
      }
      .v4-m325-companion-workspace .v4-m325-record-copy > small{
        font-size:.72rem;
        line-height:1.22;
      }
      .v4-m325-companion-workspace .v4-m325-list-actions{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr));
        width:100%;
        gap:5px;
      }
      .v4-m325-companion-workspace .v4-m325-list-actions .button{
        flex:none;
        width:100%!important;
        min-width:0!important;
        min-height:34px!important;
        padding:5px 7px!important;
        font-size:.72rem;
        line-height:1.08;
        white-space:nowrap;
      }
      .v4-m325-companion-workspace .v4-m325-member{
        gap:6px;
        padding-top:8px;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions{
        display:grid!important;
        grid-template-columns:repeat(8,minmax(0,1fr))!important;
        width:100%;
        gap:5px;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-move-member][data-direction="-1"]{
        grid-column:1 / span 1;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-move-member][data-direction="1"]{
        grid-column:2 / span 1;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-edit-member]{
        grid-column:3 / span 6;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-unlink-person],
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-link-person]{
        grid-column:1 / span 4;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-delete-member]{
        grid-column:5 / span 4;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions .button{
        flex:none;
        width:100%!important;
        min-width:0!important;
        min-height:34px!important;
        padding:5px 6px!important;
        overflow:hidden;
        font-size:.72rem;
        line-height:1.08;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-move-member]{
        padding-inline:0!important;
        font-size:.95rem;
      }
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-unlink-person],
      .v4-m325-companion-workspace .v4-m325-member-actions [data-m325-link-person]{
        font-size:.69rem;
      }
      .v4-m325-companion-workspace .v4-m325-list-actions .button.danger,
      .v4-m325-companion-workspace .v4-m325-member-actions .button.danger{
        border-color:color-mix(in srgb,var(--danger) 36%,var(--line))!important;
        background:color-mix(in srgb,var(--danger) 9%,#fff)!important;
        color:var(--danger)!important;
        box-shadow:none!important;
      }
      .v4-m325-companion-workspace .v4-m325-new-list{
        gap:6px!important;
        padding:9px!important;
        border-radius:13px;
      }
      .v4-m325-companion-workspace .v4-m325-new-list form{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        align-items:end;
        gap:6px!important;
      }
      .v4-m325-companion-workspace .v4-m325-new-list form > label.v4-field-full{
        grid-column:1!important;
        min-width:0;
        gap:4px;
        margin:0;
        font-size:.75rem;
        line-height:1.15;
      }
      .v4-m325-companion-workspace .v4-m325-new-list input{
        width:100%;
        min-width:0;
        min-height:36px!important;
        padding:7px 9px!important;
        border-radius:11px;
        font-size:.78rem;
      }
      .v4-m325-companion-workspace .v4-m325-new-list .v4-detail-actions.v4-field-full{
        grid-column:2!important;
        width:auto;
        min-width:0;
        margin:0;
        align-self:end;
      }
      .v4-m325-companion-workspace .v4-m325-new-list .button{
        width:auto!important;
        min-height:36px!important;
        padding:6px 9px!important;
        font-size:.74rem;
        line-height:1.08;
        white-space:nowrap;
      }
    }

    @media(max-width:350px){
      .v4-m325-companion-workspace .v4-m325-new-list form{
        grid-template-columns:minmax(0,1fr)!important;
      }
      .v4-m325-companion-workspace .v4-m325-new-list .v4-detail-actions.v4-field-full{
        grid-column:1!important;
      }
    }
  `;
  document.head.append(style);
}
