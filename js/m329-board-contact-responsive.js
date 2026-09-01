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
      .m329-v2-board-actions{
        grid-template-columns:1fr!important;
        width:min(100%,11.5rem)!important;
        max-width:11.5rem!important;
        gap:.38rem!important;
        margin-inline:auto!important;
      }
      .m329-v2-board-actions .m329-v2-contact-button{
        min-height:2.3rem!important;
        padding:.4rem .55rem!important;
        font-size:.68rem!important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureStyles();
