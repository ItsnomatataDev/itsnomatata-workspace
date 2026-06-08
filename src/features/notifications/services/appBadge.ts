type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function getBadgeNavigator() {
  if (typeof navigator === "undefined") return null;
  return navigator as BadgeNavigator;
}

export function isAppBadgeSupported() {
  const badgeNavigator = getBadgeNavigator();
  return Boolean(badgeNavigator?.setAppBadge && badgeNavigator.clearAppBadge);
}

export async function syncAppBadge(unreadCount: number) {
  const badgeNavigator = getBadgeNavigator();
  if (!badgeNavigator?.setAppBadge || !badgeNavigator.clearAppBadge) return;

  try {
    if (unreadCount > 0) {
      await badgeNavigator.setAppBadge(unreadCount);
    } else {
      await badgeNavigator.clearAppBadge();
    }
  } catch (err) {
    console.warn("APP BADGE SYNC:", err);
  }
}
