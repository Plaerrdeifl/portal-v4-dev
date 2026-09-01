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
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        width:100%!important;
        max-width:none!important;
        gap:.24rem!important;
        margin-inline:auto!important;
      }
      .m329-v2-board-actions .m329-v2-contact-button{
        min-height:2.2rem!important;
        padding:.34rem .22rem!important;
        gap:.18rem!important;
        font-size:.61rem!important;
        white-space:nowrap!important;
      }
      .m329-v2-board-actions .m329-v2-contact-button svg{
        width:.86rem!important;
        height:.86rem!important;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureStyles();
