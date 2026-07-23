import webpush from "npm:web-push@3.6.7";
function env(name) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Umgebungsvariable fehlt: ${name}`);
  return value;
}

function serviceKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (raw) {
    const parsed = JSON.parse(raw);
    const candidate =
      parsed.default
      || parsed.secret
      || parsed.service_role
      || Object.values(parsed).find(value => typeof value === "string");

    if (candidate) return candidate;
  }

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  throw new Error("Kein Supabase-Secret-Key verfügbar.");
}

async function rpc(supabaseUrl, key, functionName, payload = {}) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data?.message
      || data?.error
      || text
      || `RPC ${functionName} ist fehlgeschlagen.`;

    throw new Error(String(message));
  }

  return data;
}

function errorText(error) {
  return String(
    error?.body
    || error?.message
    || error
    || "Unbekannter Push-Fehler"
  ).slice(0, 2000);
}

function isRetryable(error) {
  const status = Number(error?.statusCode || error?.status || 0);
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function isGone(error) {
  const status = Number(error?.statusCode || error?.status || 0);
  return status === 404 || status === 410;
}

Deno.serve(async request => {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, {
      status: 405
    });
  }

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const key = serviceKey();
    const candidateSecret =
      request.headers.get("x-push-dispatch-secret") || "";

    const validSecret = await rpc(
      supabaseUrl,
      key,
      "pd_push_validate_dispatch_secret",
      { p_candidate: candidateSecret }
    );

    if (validSecret !== true) {
      return Response.json({ ok: false, error: "Unauthorized" }, {
        status: 401
      });
    }

    const publicKey = env("VAPID_PUBLIC_KEY");
    const privateKey = env("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT")
      || "https://plaerrdeifl.github.io";

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const batch = await rpc(
      supabaseUrl,
      key,
      "pd_push_claim_batch",
      { p_limit: 25 }
    );

    const notifications = Array.isArray(batch) ? batch : [];
    let sent = 0;
    let failed = 0;
    let disabled = 0;

    for (const item of notifications) {
      const successSubscriptionIds = [];
      const disabledSubscriptionIds = [];
      let failureCount = 0;
      let retryable = false;
      const errors = [];

      const payload = JSON.stringify({
        title: item.title,
        body: item.body,
        route: item.route || "#/dashboard",
        eventType: item.eventType,
        notificationId: item.notificationId,
        badgeCount: Number(item.badgeCount || 0)
      });

      for (const subscription of item.subscriptions || []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys
            },
            payload,
            {
              TTL: 300,
              urgency: item.eventType === "TASK_TRANSFER_REQUESTED"
                ? "high"
                : "normal"
            }
          );

          successSubscriptionIds.push(subscription.id);
          sent += 1;
        } catch (error) {
          failureCount += 1;
          failed += 1;
          retryable = retryable || isRetryable(error);
          errors.push(errorText(error));

          if (isGone(error)) {
            disabledSubscriptionIds.push(subscription.id);
            disabled += 1;
          }
        }
      }

      await rpc(
        supabaseUrl,
        key,
        "pd_push_complete",
        {
          p_payload: {
            notificationId: item.notificationId,
            successCount: successSubscriptionIds.length,
            failureCount,
            retryable,
            error: errors.join(" | ").slice(0, 2000),
            successSubscriptionIds,
            disabledSubscriptionIds
          }
        }
      );
    }

    return Response.json({
      ok: true,
      notifications: notifications.length,
      sent,
      failed,
      disabled
    });
  } catch (error) {
    console.error("send-web-push failed", error);

    return Response.json({
      ok: false,
      error: errorText(error)
    }, {
      status: 500
    });
  }
});
