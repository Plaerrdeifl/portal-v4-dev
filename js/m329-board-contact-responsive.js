const STYLE_ID = "m329BoardContactResponsiveStyle";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .m329-v2-board-card{
      container-type:inline-size;
      container-name:m329-board-card;
    }
    @container m329-board-card (max-width:16rem){
      .m329-v2-board-card .m329-board-contact{
        box-sizing:border-box!important;
        overflow:hidden!important;
      }
      .m329-v2-board-actions{
        grid-template-columns:minmax(0,1.18fr) minmax(0,.82fr)!important;
        width:100%!important;
        max-width:none!important;
        gap:.24rem!important;
        margin-inline:auto!important;
      }
      .m329-v2-board-actions .m329-v2-contact-button{
        min-width:0!important;
        max-width:100%!important;
        min-height:2.2rem!important;
        padding:.34rem .2rem!important;
        gap:.16rem!important;
        font-size:.61rem!important;
        white-space:nowrap!important;
        overflow:hidden!important;
      }
      .m329-v2-board-actions .m329-v2-contact-button svg,
      .m329-v2-board-actions .m329-v2-contact-button .m329-whatsapp-brand-mark{
        position:static!important;
        inset:auto!important;
        width:.8rem!important;
        height:.8rem!important;
        margin:0!important;
        transform:none!important;
        flex:0 0 auto!important;
      }
      .m329-v2-board-actions .m329-v2-contact-button span{
        min-width:0!important;
        overflow:hidden!important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureStyles();
