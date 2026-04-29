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

  const options = {
    body: data.message || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.notificationId || undefined,
    renotify: Boolean(data.notificationId),
    data: {
      url: data.actionUrl || "/notifications",
      notificationId: data.notificationId || null,
      type: data.type || null,
      priority: data.priority || "medium",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/notifications";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then(function (clientList) {
        for (const client of clientList) {
          if ("focus" in client && "navigate" in client) {
            client.navigate(url);
            client.focus();
            return;
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
