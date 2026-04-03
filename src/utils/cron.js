/**
 * Custom Cron Module - deno-cron style for Node.js
 * 
 * Mimics the deno-cron community module API:
 *   cron('* * * * *', callback)
 * 
 * No external dependencies. Uses Node.js built-in setInterval.
 * Supports: minute, hour, day, month, weekday wildcards (*).
 */

/**
 * Parse cron field: supports * and specific numbers
 * @param {string} field - cron field (e.g. '*', '5', '30')
 * @param {number} current - current value to match against
 * @returns {boolean}
 */
function matchField(field, current) {
  if (field === '*') return true;
  return parseInt(field, 10) === current;
}

/**
 * Check if the current time matches a given cron expression.
 * @param {string} expression - e.g. '* * * * *'
 * @returns {boolean}
 */
function matchesCronExpression(expression) {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expression.split(' ');
  const now = new Date();
  return (
    matchField(minute, now.getMinutes()) &&
    matchField(hour, now.getHours()) &&
    matchField(dayOfMonth, now.getDate()) &&
    matchField(month, now.getMonth() + 1) &&
    matchField(dayOfWeek, now.getDay())
  );
}

/**
 * Schedule a function matching a cron expression.
 * Runs a check every 60 seconds at the top of each minute.
 * 
 * @param {string} expression - cron expression (e.g. '* * * * *')
 * @param {Function} callback - async function to run
 */
function cron(expression, callback) {
  // Wait until the start of the next minute before starting interval
  const now = new Date();
  const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {
    // Execute once at top of minute if matches
    if (matchesCronExpression(expression)) {
      Promise.resolve(callback()).catch(console.error);
    }

    // Then repeat every 60 seconds
    setInterval(() => {
      if (matchesCronExpression(expression)) {
        Promise.resolve(callback()).catch(console.error);
      }
    }, 60 * 1000);
  }, msUntilNextMinute);
}

module.exports = { cron };
