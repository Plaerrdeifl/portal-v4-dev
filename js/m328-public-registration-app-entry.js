let observer = null;

function markAppRegistrationLink(link) {
  if (!(link instanceof HTMLAnchorElement)) return;
  const rawHref = String(link.getAttribute("href") || "").trim();
  if (!rawHref.includes("fanbus-anmeldung.html?trip=")) return;

  try {
    const url = new URL(rawHref, window.location.href);
    if (url.origin !== window.location.origin
        || !url.pathname.endsWith("/fanbus-anmeldung.html")) return;
    url.searchParams.set("source", "app");
    link.setAttribute(
      "href",
      `./fanbus-anmeldung.html?${url.searchParams.toString()}`
    );
  } catch {
    // Ein nicht auflösbarer Link bleibt unverändert.
  }
}

function markAppRegistrationLinks(root) {
  if (!(root instanceof Element) && root !== document) return;
  root.querySelectorAll('a[href*="fanbus-anmeldung.html?trip="]')
    .forEach(markAppRegistrationLink);
}

export function setupM328PublicRegistrationAppEntry() {
  const root = document.getElementById("m310FanbusPage") || document;
  markAppRegistrationLinks(root);

  observer?.disconnect();
  observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('a[href*="fanbus-anmeldung.html?trip="]')) {
          markAppRegistrationLink(node);
        }
        markAppRegistrationLinks(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}
