import "./m328-final-acceptance.js?v=20260830-m328-final-acceptance2";
import "./m328-booking-filter-cleanup.js?v=20260830-m328-booking-filter-cleanup1";

function installM328TripEditIosFieldFix() {
  if (document.getElementById("m328TripEditIosFieldFix")) return;

  const style = document.createElement("style");
  style.id = "m328TripEditIosFieldFix";
  style.textContent = `
    .m328-trip-edit .m328-trip-edit-core-grid > label,
    .m328-trip-edit .m328-trip-edit-stop-editor > label{
      min-width:0!important;
      max-width:100%!important;
    }

    .m328-trip-edit .m328-trip-edit-core-grid input[type="time"],
    .m328-trip-edit .m328-trip-edit-core-grid input[type="datetime-local"],
    .m328-trip-edit .m328-trip-edit-stop-editor input[type="time"]{
      display:block!important;
      width:100%!important;
      max-width:100%!important;
      min-width:0!important;
      inline-size:100%!important;
      max-inline-size:100%!important;
      min-inline-size:0!important;
      box-sizing:border-box!important;
      padding:0!important;
    }

    .m328-trip-edit .m328-trip-edit-stop-editor select{
      width:100%!important;
      max-width:100%!important;
      min-width:0!important;
      box-sizing:border-box!important;
    }

    .m328-trip-edit .m328-trip-edit-core-grid{
      min-width:0!important;
    }

    .m328-trip-edit .m328-trip-edit-deadline{
      min-width:0!important;
      max-width:100%!important;
    }

    .m328-trip-edit .m328-trip-edit-stop-editor{
      min-width:0!important;
      max-width:100%!important;
    }

    @media (max-width:430px){
      .m328-trip-edit .m328-trip-edit-stop-editor{
        grid-template-columns:minmax(112px,.82fr) minmax(0,1.18fr)!important;
        gap:8px!important;
      }
    }

    @media (max-width:350px){
      .m328-trip-edit .m328-trip-edit-stop-editor{
        grid-template-columns:1fr!important;
      }
    }
  `;
  document.head.appendChild(style);
}

installM328TripEditIosFieldFix();

export function noop() {}
