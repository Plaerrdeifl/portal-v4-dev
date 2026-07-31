import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test(
  "initial Supabase session cannot trigger a second login render",
  async () => {
    const auth = await read("js/auth.js");

    assert.match(
      auth,
      /if \(event === "INITIAL_SESSION"\) \{\s*return;\s*\}/
    );

    assert.doesNotMatch(
      auth,
      /\["SIGNED_IN", "INITIAL_SESSION"/
    );
  }
);

test(
  "login is revealed only after the final Google iframe is ready",
  async () => {
    const [gate, google, css] = await Promise.all([
      read("js/auth-gate.js"),
      read("js/google-signin.js"),
      read("css/app.css")
    ]);

    assert.match(
      gate,
      /await renderGoogleSignInButton[\s\S]*revealPreparedLogin/
    );

    assert.match(
      gate,
      /login\.dataset\.preparing = "true"/
    );

    assert.match(
      css,
      /auth-login-card\[data-preparing="true"\]\{[^}]*opacity:0/
    );

    assert.doesNotMatch(
      css,
      /auth-login-card\[data-preparing="true"\]\{[^}]*visibility:hidden/
    );

    assert.match(
      google,
      /await waitForRenderedButton\(element\)/
    );

    assert.match(
      google,
      /width > 0 && height > 0/
    );

    assert.match(
      google,
      /stableFrames >= 3/
    );

    assert.doesNotMatch(google, /ResizeObserver/);
    assert.match(google, /renderedElements\.has\(element\)/);
  }
);
