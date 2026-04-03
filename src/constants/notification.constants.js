/**
 * Notification Templates and Constants
 * 
 * Key: Meaningful key used to trigger the notification
 * Fields:
 * - title: Notification heading
 * - body: Main message content
 * - module: The module/type this belongs to (e.g., 'reminders', 'rewards', 'workouts')
 * - event: The specific event that triggered this (e.g., 'scheduled', 'completed', 'unlocked')
 */
const NOTIFICATION_TEMPLATES = {
  // --- REMINDERS MODULE ---
  morning_briefing: {
    title: "Morning Briefing",
    body: "Here is your daily meal plan, workout routine, and calorie goals. Let's conquer the day!",
    module: "reminders",
    event: "daily_morning_briefing" // Derived from Notification Type
  },
  workout: {
    title: "Workout Reminder",
    body: "Did you complete your training session today? Keep up the great work!",
    module: "workouts",
    event: "workout_reminder"
  },
  meal: {
    title: "Meal Reminder",
    body: "Stay on top of your nutrition. It's time for your next meal!",
    module: "meals",
    event: "meal_reminder"
  },
  weekly_weigh_in: {
    title: "Weekly Weigh-In",
    body: "Time to track your progress! Please log your current weight and body measurements.",
    module: "progress",
    event: "weekly_weigh_in"
  },
  daily_motivation: {
    title: "Daily Motivation",
    body: "Stay inspired! Remember why you started this journey.",
    module: "reminders",
    event: "daily_motivation"
  },

  // --- STATS / PROGRESS ---
  meal_plan_update: {
    title: "Meal Plan Updated",
    body: "Your meal plan has been adjusted to match your new biological stats.",
    module: "meals",
    event: "meal_plan_update"
  },

  // --- RE-ENGAGEMENT ---
  re_engagement: {
    title: "We Miss You!",
    body: "It's time to get back into your routine. Open the app to crush your goals today!",
    module: "general",
    event: "re_engagement_prompt"
  }
};

/**
 * Helper to get a notification template by key.
 * Falls back to a generic default if the key isn't found.
 */
const getNotificationTemplate = (key) => {
  return NOTIFICATION_TEMPLATES[key] || {
    title: "New Notification",
    body: "You have a new update in the app.",
    module: "general",
    event: "unknown"
  };
};

module.exports = {
  NOTIFICATION_TEMPLATES,
  getNotificationTemplate
};
