import assert from "node:assert/strict";
import test from "node:test";

test("Google Identity Services uses a stable official medium button with popup UX and nonce", async () => {
  let initializeOptions = null;
  let renderOptions = null;
  let callbackResult = null;

  globalThis.window = {
    google: {
      accounts: {
        id: {
          initialize(options) {
            initializeOptions = options;
          },
          renderButton(element, options) {
            element.rendered = true;
            renderOptions = options;
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
      throw new Error("Die Google-Bibliothek sollte im Test bereits vorhanden sein.");
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

  const element = {
    rendered: false,
    clientWidth: 300,
    getBoundingClientRect() {
      return { width: 300 };
    },
    hasChildNodes() {
      return this.rendered;
    },
    replaceChildren() {}
  };

  await module.renderGoogleSignInButton(element, {
    clientId: "123456789-example.apps.googleusercontent.com",
    onCredential(response, nonce) {
      callbackResult = { response, nonce };
    }
  });

  assert.equal(element.rendered, true);
  assert.equal(initializeOptions.client_id, "123456789-example.apps.googleusercontent.com");
  assert.equal(initializeOptions.ux_mode, "popup");
  assert.equal(initializeOptions.auto_select, false);
  assert.equal(initializeOptions.use_fedcm_for_button, true);
  assert.equal(initializeOptions.button_auto_select, false);
  assert.equal(
    Object.hasOwn(initializeOptions, "use_fedcm_for_prompt"),
    false
  );
  assert.match(initializeOptions.nonce, /^[a-f0-9]{64}$/);

  assert.equal(renderOptions.theme, "filled_blue");
  assert.equal(renderOptions.shape, "pill");
  assert.equal(renderOptions.size, "medium");
  assert.equal(renderOptions.width, 276);
  assert.equal(renderOptions.locale, "de");

  initializeOptions.callback({ credential: "jwt-token" });

  assert.equal(callbackResult.response.credential, "jwt-token");
  assert.match(callbackResult.nonce, /^[A-Za-z0-9_-]{40,}$/);
});
