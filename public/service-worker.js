self.addEventListener("install", function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

function readMetadataString(metadata, keys) {
  if (!metadata || typeof metadata !== "object") return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function resolvePushActionUrl(data) {
  const fallback = "/notifications";
  const metadata =
    data.metadata && typeof data.metadata === "object" ? data.metadata : null;

  const draftId =
    readMetadataString(metadata, ["draftId", "draft_id"]) ??
    (data.entityType === "content_review_draft" ? data.entityId : null);

  const isContentReview =
    data.category === "content_review" ||
    data.entityType === "content_review_draft" ||
    (typeof data.actionUrl === "string" &&
      data.actionUrl.startsWith("/admin/content-studio"));

  if (draftId && isContentReview) {
    return `/admin/content-studio/editor/${draftId}`;
  }

  if (typeof data.actionUrl === "string" && data.actionUrl.startsWith("/")) {
    return data.actionUrl;
  }

  return fallback;
}

function resolveActionUrl(actionUrl, data) {
  const path = resolvePushActionUrl({
    actionUrl,
    metadata: data?.metadata,
    entityType: data?.entityType,
    entityId: data?.entityId,
    category: data?.category,
  });

  try {
    return new URL(path, self.location.origin).href;
  } catch {
    return new URL("/notifications", self.location.origin).href;
  }
}

function isAppTabVisible(clientList) {
  return clientList.some(function (client) {
    return (
      client.visibilityState === "visible" &&
      typeof client.url === "string" &&
      client.url.startsWith(self.location.origin)
    );
  });
}

async function syncAppBadge(unreadCount) {
  if (
    typeof self.registration.setAppBadge !== "function" ||
    typeof self.registration.clearAppBadge !== "function"
  ) {
    return;
  }

  try {
    const count = Number.isFinite(Number(unreadCount))
      ? Math.max(0, Math.trunc(Number(unreadCount)))
      : 0;

    if (count > 0) {
      await self.registration.setAppBadge(count);
    } else {
      await self.registration.clearAppBadge();
    }
  } catch (err) {
    console.warn("APP BADGE SERVICE WORKER:", err);
  }
}

self.addEventListener("push", function (event) {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "New notification",
      message: event.data ? event.data.text() : "",
    };
  }

  const title = data.title || "New notification";
  const targetUrl = resolveActionUrl(data.actionUrl, data);

  const options = {
    body: data.message || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    tag: data.notificationId || undefined,
    renotify: Boolean(data.notificationId),
    data: {
      url: targetUrl,
      notificationId: data.notificationId || null,
      type: data.type || null,
      priority: data.priority || "medium",
    },
  };

  event.waitUntil(
    Promise.all([
      syncAppBadge(data.unreadCount ?? 1),
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(function (clientList) {
          if (isAppTabVisible(clientList)) {
            return;
          }

          return self.registration.showNotification(title, options);
        }),
    ]),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url =
    event.notification.data?.url ||
    new URL("/notifications", self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(async function (clientList) {
        for (const client of clientList) {
          if (!("focus" in client)) continue;

          await client.focus();

          if ("navigate" in client && typeof client.navigate === "function") {
            return client.navigate(url);
          }

          client.postMessage({
            type: "NOTIFICATION_CLICK",
            url: url,
          });
          return;
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
