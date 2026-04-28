require('dotenv').config();
const notifications = require('../modules/notifications/service');

notifications.notify({
  eventType: 'notification.test',
  subject: 'Alliance Backoffice test notification',
  text: [
    'This is a test notification from Alliance Backoffice.',
    '',
    'If you received this, notifications are configured correctly.'
  ].join('\n')
}).then(() => {
  console.log('Notification test completed. Check the configured inbox/webhook.');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
