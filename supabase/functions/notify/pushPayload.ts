export function fcmMessage(
  token: string,
  job: { title: string; body: string; data: Record<string, unknown> },
) {
  return {
    message: {
      token,
      notification: { title: job.title, body: job.body },
      // expo-notifications reads its navigation payload from the JSON body.
      data: {
        body: JSON.stringify(job.data),
        title: job.title,
        message: job.body,
        channelId: 'work-updates',
      },
      android: {
        priority: 'HIGH',
        ttl: '3600s',
        notification: { channel_id: 'work-updates', sound: 'default' },
      },
    },
  };
}
