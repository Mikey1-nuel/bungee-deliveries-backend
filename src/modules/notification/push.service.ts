import { firebaseAdmin } from "../../config/firebase";

interface SendPushNotificationInput {
  token: string;

  title: string;

  body: string;

  data?: Record<string, string>;
}

export const sendPushNotification = async ({
  token,
  title,
  body,
  data = {},
}: SendPushNotificationInput) => {
  try {
    await firebaseAdmin.messaging().send({
      token,

      notification: {
        title,
        body,
      },

      data,
    });
  } catch (error) {
    console.error("Push notification error:", error);
  }
};
