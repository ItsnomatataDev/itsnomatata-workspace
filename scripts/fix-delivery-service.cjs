const fs = require("fs");
const path =
  "src/features/notifications/services/notificationDeliveryService.ts";
let content = fs.readFileSync(path, "utf8");

// First replacement: deliverNotification function
const marker1 = `    console.log("NOTIFICATION INSERTED:", notification);

    // Temporarily disable email to isolate in-system notification issues
    return notification;`;

const replacement1 = `    console.log("NOTIFICATION INSERTED:", notification);

    // Send email if enabled
    if (params.sendEmail !== false) {
      try {
        const { profile, canEmail } = await getUserEmailPreferences(
          params.userId,
          params.type,
          priority,
        );

        if (profile && canEmail) {
          await triggerNotificationEmail({
            to: profile.email!,
            fullName: profile.full_name,
            title: params.title,
            message: params.message,
            actionUrl: params.actionUrl,
            type: params.type,
            priority,
            metadata: params.metadata,
            organizationId: params.organizationId,
            userId: params.userId,
            notificationId: notification.id,
          });
        }
      } catch (emailError) {
        console.error("EMAIL SEND ERROR:", emailError);
      }
    }

    return notification;`;

// Second replacement: deliverBulkNotifications function
const marker2 = `    console.log("BULK NOTIFICATIONS INSERTED:", notifications);

    // Temporarily disable email to isolate in-system notification issues
    return notifications;`;

const replacement2 = `    console.log("BULK NOTIFICATIONS INSERTED:", notifications);

    // Send emails if enabled
    if (params.sendEmail !== false && notifications.length > 0) {
      try {
        await Promise.all(
          notifications.map(async (n) => {
            const { profile, canEmail } = await getUserEmailPreferences(
              n.user_id,
              params.type,
              priority,
            );
            if (profile && canEmail) {
              await triggerNotificationEmail({
                to: profile.email!,
                fullName: profile.full_name,
                title: params.title,
                message: params.message,
                actionUrl: params.actionUrl,
                type: params.type,
                priority,
                metadata: params.metadata,
                organizationId: params.organizationId,
                userId: n.user_id,
                notificationId: n.id,
              });
            }
          }),
        );
      } catch (emailError) {
        console.error("BULK EMAIL SEND ERROR:", emailError);
      }
    }

    return notifications;`;

if (!content.includes(marker1)) {
  console.error("Marker 1 not found");
  process.exit(1);
}

if (!content.includes(marker2)) {
  console.error("Marker 2 not found");
  process.exit(1);
}

// Replace sequentially - using split/join to replace only first occurrence each time
function replaceFirst(str, search, replace) {
  const idx = str.indexOf(search);
  if (idx === -1) return str;
  return str.substring(0, idx) + replace + str.substring(idx + search.length);
}

content = replaceFirst(content, marker1, replacement1);
content = replaceFirst(content, marker2, replacement2);

fs.writeFileSync(path, content);
console.log("Updated notificationDeliveryService.ts successfully");
