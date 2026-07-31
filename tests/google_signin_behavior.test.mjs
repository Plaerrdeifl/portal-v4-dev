import assert from "node:assert/strict";
import test from "node:test";

test(
  "Google Identity Services renders the visible button exactly once",
  async context => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalResizeObserver = globalThis.ResizeObserver;

    context.after(() => {
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;

      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;

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
    let renderedIframe = null;
    let geometryReadCount = 0;

    globalThis.ResizeObserver = class {
      constructor() {
        throw new Error(
          "Der endgültige Google-Button darf keinen ResizeObserver verwenden."
        );
      }
    };

    globalThis.window = {
      google: {
        accounts: {
          id: {
            initialize(options) {
              initializeOptions = options;
            },

            renderButton(_element, options) {
              renderCount += 1;
              renderOptions = options;

              renderedIframe = {
                addEventListener(event, callback) {
                  if (event === "load") {
                    setTimeout(callback, 0);
                  }
                },

                getBoundingClientRect() {
                  geometryReadCount += 1;

                  if (geometryReadCount < 3) {
                    return {
                      width: 0,
                      height: 0
                    };
                  }

                  return {
                    width: 276,
                    height: 44
                  };
                }
              };
            }
          }
        }
      },
      innerWidth: 393,
      requestAnimationFrame(callback) {
        return setTimeout(callback, 0);
      },
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

    const module = await import(
      `../js/google-signin.js?test=${Date.now()}`
    );

    const parent = {
      clientWidth: 340,

      getBoundingClientRect() {
        return { width: this.clientWidth };
      }
    };

    const element = {
      parentElement: parent,
      clientWidth: 300,

      getBoundingClientRect() {
        return { width: this.clientWidth };
      },

      replaceChildren() {},

      querySelector(selector) {
        return selector === "iframe"
          ? renderedIframe
          : null;
      }
    };

    const options = {
      clientId:
        "123456789-example.apps.googleusercontent.com",

      onCredential(response, nonce) {
        callbackResult = { response, nonce };
      }
    };

    await module.renderGoogleSignInButton(element, options);
    await module.renderGoogleSignInButton(element, options);

    assert.ok(
      geometryReadCount >= 5,
      "Die Freigabe muss auf eine stabile sichtbare iframe-Größe warten."
    );

    assert.equal(
      renderCount,
      1,
      "Der Google-Button darf nach seiner Erzeugung nicht ersetzt werden."
    );

    assert.equal(
      initializeOptions.client_id,
      "123456789-example.apps.googleusercontent.com"
    );

    assert.equal(initializeOptions.ux_mode, "popup");
    assert.equal(initializeOptions.auto_select, false);
    assert.equal(initializeOptions.use_fedcm_for_button, true);
    assert.equal(initializeOptions.button_auto_select, false);
    assert.match(initializeOptions.nonce, /^[a-f0-9]{64}$/);

    assert.equal(renderOptions.theme, "filled_blue");
    assert.equal(renderOptions.shape, "pill");
    assert.equal(renderOptions.size, "medium");
    assert.equal(renderOptions.width, 276);
    assert.equal(renderOptions.locale, "de");

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
