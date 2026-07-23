const RELEASE = "20260723-ios-standalone-geometry-diagnostic-r1";

const standalone =
  window.matchMedia("(display-mode: standalone)").matches
  || window.navigator.standalone === true;

if (standalone) {
  const ready = callback => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  };

  ready(() => {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = [
      "position:fixed",
      "inset:0 auto auto 0",
      "width:0",
      "height:0",
      "padding-top:env(safe-area-inset-top)",
      "padding-bottom:env(safe-area-inset-bottom)",
      "padding-left:env(safe-area-inset-left)",
      "padding-right:env(safe-area-inset-right)",
      "visibility:hidden",
      "pointer-events:none"
    ].join(";");
    document.body.append(probe);

    const panel = document.createElement("aside");
    panel.id = "pdStandaloneGeometryDiagnostic";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "iOS Standalone Geometrie-Diagnose");
    panel.style.cssText = [
      "position:fixed",
      "z-index:2147483647",
      "top:max(8px,env(safe-area-inset-top))",
      "left:8px",
      "right:8px",
      "max-height:48dvh",
      "overflow:auto",
      "padding:10px",
      "border:2px solid #ffcf33",
      "border-radius:12px",
      "background:rgba(3,25,46,.96)",
      "color:#fff",
      "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace",
      "box-shadow:0 12px 36px rgba(0,0,0,.45)",
      "-webkit-overflow-scrolling:touch"
    ].join(";");

    const heading = document.createElement("div");
    heading.textContent = "GEOMETRIE-DIAGNOSE – SCREENSHOT SENDEN";
    heading.style.cssText = [
      "font-weight:800",
      "color:#ffdf66",
      "margin-bottom:7px"
    ].join(";");

    const output = document.createElement("pre");
    output.style.cssText = [
      "margin:0",
      "white-space:pre-wrap",
      "overflow-wrap:anywhere"
    ].join(";");

    const actions = document.createElement("div");
    actions.style.cssText = [
      "display:flex",
      "gap:8px",
      "position:sticky",
      "bottom:-10px",
      "margin:9px -10px -10px",
      "padding:8px 10px",
      "background:#03192e"
    ].join(";");

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Werte kopieren";
    copyButton.style.cssText = [
      "flex:1",
      "min-height:36px",
      "border:0",
      "border-radius:9px",
      "background:#fff",
      "color:#03192e",
      "font-weight:700"
    ].join(";");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Schließen";
    closeButton.style.cssText = copyButton.style.cssText;

    actions.append(copyButton, closeButton);
    panel.append(heading, output, actions);
    document.body.append(panel);

    const viewportMarker = document.createElement("div");
    viewportMarker.setAttribute("aria-hidden", "true");
    viewportMarker.style.cssText = [
      "position:fixed",
      "z-index:2147483646",
      "left:0",
      "right:0",
      "bottom:0",
      "height:4px",
      "background:#ff2d55",
      "pointer-events:none"
    ].join(";");
    document.body.append(viewportMarker);

    const navMarker = document.createElement("div");
    navMarker.setAttribute("aria-hidden", "true");
    navMarker.style.cssText = [
      "position:fixed",
      "z-index:2147483646",
      "left:0",
      "right:0",
      "height:4px",
      "background:#35e06f",
      "pointer-events:none"
    ].join(";");
    document.body.append(navMarker);

    const px = value => {
      const number = Number.parseFloat(value);
      return Number.isFinite(number) ? number : null;
    };

    const round = value =>
      Number.isFinite(value) ? Math.round(value * 100) / 100 : null;

    const collect = () => {
      const nav = document.querySelector(".mobile-bottom-nav");
      const navStyle = nav ? getComputedStyle(nav) : null;
      const navRect = nav ? nav.getBoundingClientRect() : null;
      const probeStyle = getComputedStyle(probe);
      const htmlStyle = getComputedStyle(document.documentElement);
      const bodyStyle = getComputedStyle(document.body);
      const vv = window.visualViewport;

      const values = {
        release: RELEASE,
        standaloneMedia: window.matchMedia(
          "(display-mode: standalone)"
        ).matches,
        navigatorStandalone: window.navigator.standalone ?? null,
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight
        },
        window: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        },
        visualViewport: vv ? {
          width: round(vv.width),
          height: round(vv.height),
          offsetLeft: round(vv.offsetLeft),
          offsetTop: round(vv.offsetTop),
          pageLeft: round(vv.pageLeft),
          pageTop: round(vv.pageTop),
          scale: round(vv.scale)
        } : null,
        document: {
          htmlClientHeight: document.documentElement.clientHeight,
          htmlScrollHeight: document.documentElement.scrollHeight,
          bodyClientHeight: document.body.clientHeight,
          bodyScrollHeight: document.body.scrollHeight
        },
        safeArea: {
          top: px(probeStyle.paddingTop),
          right: px(probeStyle.paddingRight),
          bottom: px(probeStyle.paddingBottom),
          left: px(probeStyle.paddingLeft)
        },
        nav: navRect ? {
          top: round(navRect.top),
          bottom: round(navRect.bottom),
          height: round(navRect.height),
          gapToInnerBottom: round(
            window.innerHeight - navRect.bottom
          ),
          gapToVisualBottom: vv
            ? round(
                vv.offsetTop + vv.height - navRect.bottom
              )
            : null,
          computedBottom: navStyle.bottom,
          computedHeight: navStyle.height,
          paddingTop: navStyle.paddingTop,
          paddingBottom: navStyle.paddingBottom,
          position: navStyle.position,
          overflow: navStyle.overflow
        } : null,
        containers: {
          htmlHeight: htmlStyle.height,
          htmlMinHeight: htmlStyle.minHeight,
          htmlOverflow: htmlStyle.overflow,
          htmlBackground: htmlStyle.backgroundColor,
          bodyHeight: bodyStyle.height,
          bodyMinHeight: bodyStyle.minHeight,
          bodyOverflow: bodyStyle.overflow,
          bodyBackground: bodyStyle.backgroundColor
        }
      };

      if (navRect) {
        navMarker.style.top = `${Math.max(0, navRect.bottom - 2)}px`;
      } else {
        navMarker.style.display = "none";
      }

      output.textContent = JSON.stringify(values, null, 2);
      return output.textContent;
    };

    copyButton.addEventListener("click", async () => {
      const text = collect();

      try {
        await navigator.clipboard.writeText(text);
        copyButton.textContent = "Kopiert";
      } catch {
        copyButton.textContent = "Screenshot senden";
      }

      window.setTimeout(() => {
        copyButton.textContent = "Werte kopieren";
      }, 1600);
    });

    closeButton.addEventListener("click", () => {
      panel.remove();
      viewportMarker.remove();
      navMarker.remove();
      probe.remove();
    });

    const refresh = () => window.requestAnimationFrame(collect);

    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.visualViewport?.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("scroll", refresh);

    window.setTimeout(collect, 500);
    window.setTimeout(collect, 1600);
  });
}
