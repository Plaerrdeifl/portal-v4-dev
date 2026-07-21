import assert from "node:assert/strict";
import test from "node:test";

test("Google Identity Services is initialized once with popup UX and a nonce", async () => {
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
  assert.equal(initializeOptions.use_fedcm_for_prompt, true);
  assert.match(initializeOptions.nonce, /^[a-f0-9]{64}$/);

  assert.equal(renderOptions.theme, "filled_blue");
  assert.equal(renderOptions.shape, "pill");
  assert.equal(renderOptions.width, 320);
  assert.equal(renderOptions.locale, "de");

  initializeOptions.callback({ credential: "jwt-token" });

  assert.equal(callbackResult.response.credential, "jwt-token");
  assert.match(callbackResult.nonce, /^[A-Za-z0-9_-]{40,}$/);
});
