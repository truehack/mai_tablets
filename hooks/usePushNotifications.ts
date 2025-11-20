// app/hooks/usePushNotifications.ts
import { useState, useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Настройка поведения уведомлений — БЕЗ устаревших параметров
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,      // ✅ звук при получении
    shouldShowBanner: true,     // ✅ баннер (iOS) / heads-up (Android)
    shouldShowList: true,       // ✅ отображение в шторке уведомлений
    shouldSetBadge: false,      // ✅ без значка на иконке (по вашим предпочтениям)
  }),
});

/**
 * Хук для настройки локальных push-уведомлений в MAI Tablets.
 * Используется ТОЛЬКО для локальных напоминаний (без сервера).
 * Возвращает "local" вместо токена — вы не синхронизируете медицинские данные.
 */
export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  // Рефы для безопасного удаления слушателей
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  /**
   * Регистрирует устройство для локальных уведомлений.
   * Не запрашивает Expo Push Token (серверные уведомления отключены).
   */
  async function registerForPushNotificationsAsync() {
    // Проверка: только физические устройства
    if (!Device.isDevice) {
      console.warn("⚠️ Уведомления работают только на физическом устройстве (не в эмуляторе)");
      return null;
    }

    // Запрос разрешения
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("🚫 Разрешение на уведомления не выдано — напоминания работать не будут");
      return null;
    }

    console.log("✅ Разрешение на уведомления получено — MAI Tablets готов к напоминаниям");

    // Настройка канала для Android (обязательно для sound/banner)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Напоминания о приёме",
        description: "Уведомления от MAI Tablets за 10 минут до приёма лекарств",
        importance: Notifications.AndroidImportance.HIGH, // MAX устарел → HIGH + sound = heads-up
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF4B80", // розовый акцент MAI Tablets
        sound: "default", // включает звук → триггерит heads-up на Android
        enableVibrate: true,
        enableLights: true,
      });
    }

    // 🔐 ВАЖНО: вы не используете серверные уведомления (автоматическая синхронизация отключена),
    // поэтому Expo Push Token не запрашиваем — возвращаем "local"
    return "local";
  }

  // Эффект: инициализация при монтировании
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      setExpoPushToken(token);
    });

    // Слушатель: уведомление получено (в фоне или foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
      console.log("🔔 Локальное уведомление получено:", notification.request.content.title);
    });

    // Слушатель: пользователь нажал на уведомление
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("📬 Пользователь открыл уведомление:", {
        title: response.notification.request.content.title,
        data: response.notification.request.content.data,
      });

      // 🔜 Здесь можно добавить навигацию к препарату, например:
      // if (response.notification.request.content.data?.medicationId) {
      //   router.push(`/medications/${response.notification.request.content.data.medicationId}`);
      // }
    });

    // Отписка при размонтировании
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken, notification };
}