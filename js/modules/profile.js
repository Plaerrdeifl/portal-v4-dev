import { auth } from "../auth.js";
import { showToast } from "../ui.js";

function clean(value) { return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim(); }
function setError(id, message) { const el=document.getElementById(id); if(el) el.textContent=message||""; }
function validate(data) {
  const vorname=clean(data.vorname), nachname=clean(data.nachname);
  setError("profileFirstError", vorname ? "" : "Vorname fehlt.");
  setError("profileLastError", nachname ? "" : "Nachname fehlt.");
  return vorname && nachname ? {vorname,nachname} : null;
}
export async function hydrateProfile() {
  const state=auth.current();
  if(!auth.requiresProfile()) { location.hash="#/dashboard"; return; }
  const suggested=state.profile?.suggestions || {};
  const first=document.getElementById("profileFirstName"), last=document.getElementById("profileLastName");
  if(first) first.value=state.profile?.vorname || suggested.vorname || "";
  if(last) last.value=state.profile?.nachname || suggested.nachname || "";
  document.getElementById("profileCompletionForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form=event.currentTarget;
    const data=validate(Object.fromEntries(new FormData(form)));
    if(!data) { form.querySelector(":invalid")?.focus(); return; }
    const submit=form.querySelector('button[type="submit"]');
    if(submit) { submit.disabled=true; submit.textContent="Wird gespeichert …"; }
    try {
      await auth.completeProfile(data);
      showToast("Profil vollständig. Portalzugriff wurde freigegeben.","success",5200);
      location.hash="#/dashboard";
    } catch(error) {
      const code=String(error?.code||"");
      if(code.includes("FIRST")) setError("profileFirstError", error.message);
      if(code.includes("LAST")) setError("profileLastError", error.message);
      if(code.includes("BOTH")) { setError("profileFirstError","Vorname fehlt."); setError("profileLastError","Nachname fehlt."); }
      showToast(error?.message||"Profil konnte nicht gespeichert werden.","error",6500);
      if(submit) { submit.disabled=false; submit.textContent="Profil speichern"; }
    }
  });
}