import assert from "node:assert/strict";
import test from "node:test";

test(
  "Google Identity Services prevents a resize render loop",
  async context => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalResizeObserver = globalThis.ResizeObserver;

    context.after(() => {
      if (originalWindow === undefined) {
        delete globalThis.window;
      }
      else {
        globalThis.window = originalWindow;
      }

      if (originalDocument === undefined) {
        delete globalThis.document;
      }
      else {
        globalThis.document = originalDocument;
      }

      if (originalResizeObserver === undefined) {
        delete globalThis.ResizeObserver;
      }
      else {
        globalThis.ResizeObserver = originalResizeObserver;
      }
    });

    let initializeOptions = null;
    let renderOptions = null;
    let callbackResult = null;
    let renderCount = 0;
    let resizeCallback = null;
    let observedElement = null;

    globalThis.window = {
      google: {
        accounts: {
          id: {
            initialize(options) {
              initializeOptions = options;
            },

            renderButton(element, options) {
              renderCount += 1;
              renderOptions = options;

              if (renderCount === 1) {
                element.rendered = false;

                queueMicrotask(() => {
                  resizeCallback?.([]);
                });

                setTimeout(() => {
                  element.rendered = true;
                }, 100);
              }
              else {
                element.rendered = true;
              }
            }
          }
        }
      },
      innerWidth: 393,
      setTimeout,
      clearTimeout
    };

    globalThis.document = {
      getElementById() {
        return null;
      },

      createElement() {
        throw new Error(
          "Die Google-Bibliothek sollte bereits vorhanden sein."
        );
      },

      head: {
        append() {
          throw new Error("Es darf kein Script nachgeladen werden.");
        }
      }
    };

    globalThis.ResizeObserver = class {
      constructor(callback) {
        resizeCallback = callback;
      }

      observe(element) {
        observedElement = element;
      }

      disconnect() {}
    };

    const module = await import(
      `../js/google-signin.js?test=${Date.now()}`
    );

    const stableParent = {
      clientWidth: 340,

      getBoundingClientRect() {
        return { width: this.clientWidth };
      }
    };

    const element = {
      parentElement: stableParent,
      rendered: false,
      clientWidth: 300,

      getBoundingClientRect() {
        return { width: this.clientWidth };
      },

      hasChildNodes() {
        return this.rendered;
      },

      replaceChildren() {
        this.rendered = false;
      }
    };

    await module.renderGoogleSignInButton(element, {
      clientId:
        "123456789-example.apps.googleusercontent.com",

      onCredential(response, nonce) {
        callbackResult = { response, nonce };
      }
    });

    assert.equal(typeof resizeCallback, "function");
    assert.equal(
      observedElement,
      stableParent,
      "Beobachtet werden muss der stabile Elterncontainer."
    );

    await new Promise(resolve => setTimeout(resolve, 30));

    assert.equal(
      renderCount,
      1,
      "Ein vorübergehend leerer Slot darf kein erneutes Rendern auslösen."
    );

    assert.equal(
      initializeOptions.client_id,
      "123456789-example.apps.googleusercontent.com"
    );
    assert.equal(initializeOptions.ux_mode, "popup");
    assert.equal(initializeOptions.auto_select, false);
    assert.equal(initializeOptions.use_fedcm_for_button, true);
    assert.equal(initializeOptions.button_auto_select, false);
    assert.equal(
      Object.hasOwn(
        initializeOptions,
        "use_fedcm_for_prompt"
      ),
      false
    );
    assert.match(initializeOptions.nonce, /^[a-f0-9]{64}$/);

    assert.equal(renderOptions.theme, "filled_blue");
    assert.equal(renderOptions.shape, "pill");
    assert.equal(renderOptions.size, "medium");
    assert.equal(renderOptions.width, 276);
    assert.equal(renderOptions.locale, "de");

    element.rendered = true;
    stableParent.clientWidth = 360;
    element.clientWidth = 320;

    resizeCallback([]);
    resizeCallback([]);
    resizeCallback([]);

    await new Promise(resolve => setTimeout(resolve, 30));

    assert.equal(
      renderCount,
      2,
      "Mehrere Resize-Signale derselben Layoutphase dürfen nur ein Neurendern auslösen."
    );
    assert.equal(renderOptions.width, 296);

    resizeCallback([]);
    await new Promise(resolve => setTimeout(resolve, 30));

    assert.equal(
      renderCount,
      2,
      "Eine unveränderte Slotbreite darf kein weiteres Rendern auslösen."
    );

    initializeOptions.callback({
      credential: "jwt-token"
    });

    assert.equal(
      callbackResult.response.credential,
      "jwt-token"
    );
    assert.match(
      callbackResult.nonce,
      /^[A-Za-z0-9_-]{40,}$/
    );
  }
);
