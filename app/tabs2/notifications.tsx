import React, { useState } from "react";
import { View, ScrollView, Button } from "react-native";
import { Text } from "react-native-paper";
import * as Notifications from "expo-notifications";
import { Screen } from "@/components/screen";
import { useDatabase } from "@/hooks/use-database";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// Функция планирования уведомления за 10 минут до приёма
async function scheduleMedicationNotification(
  name: string,
  form: string,
  time: string,
  repeats: boolean
) {
  try {
    const [hour, minute] = time.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) {
      console.warn(`⚠️ Неверный формат времени: ${time}`);
      return;
    }

    const now = new Date();
    const scheduledTime = new Date();

    scheduledTime.setHours(hour);
    scheduledTime.setMinutes(minute - 10); // 🕐 минус 10 минут
    scheduledTime.setSeconds(0);

    // Если уже прошло — переносим на завтра
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 ${name}`,
        body: `Через 10 минут нужно принять медикамент (${time})`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: repeats
        ? {
            hour: scheduledTime.getHours(),
            minute: scheduledTime.getMinutes(),
            repeats: true,
          }
        : { date: scheduledTime },
    });

    console.log(`⏰ Уведомление запланировано на ${scheduledTime} для ${name}`);
  } catch (error) {
    console.error("Ошибка при планировании уведомления:", error);
  }
}

export default function NotificationsScreen() {
  const { getMedications } = useDatabase();
  const { expoPushToken } = usePushNotifications();
  const [scheduled, setScheduled] = useState<Notifications.NotificationRequest[]>([]);

  // 📅 Планируем уведомления по данным из SQLite
  const scheduleAllMedNotifications = async () => {
    const meds = await getMedications();
    console.log("📋 Найдено лекарств:", meds.length);

    // Удаляем все старые уведомления
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const med of meds) {
      const times = Array.isArray(med.times_list)
        ? med.times_list
        : typeof med.times_list === "string"
        ? JSON.parse(med.times_list)
        : [];

      for (const time of times) {
        await scheduleMedicationNotification(
          med.name,
          med.form,
          time,
          med.schedule_type === "daily"
        );
      }
    }

    const all = await Notifications.getAllScheduledNotificationsAsync();
    setScheduled(all);
  };

  return (
    <Screen
      style={{
        flex: 1,
        backgroundColor: "#121212",
        paddingHorizontal: 16,
        paddingTop: 20,
      }}
    >
      <ScrollView contentContainerStyle={{ alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: 18, marginBottom: 10 }}>
          Уведомления о приёме лекарств
        </Text>

        <Button title="Создать уведомления из базы" onPress={scheduleAllMedNotifications} />

        <Button
          title="Очистить все уведомления"
          color="#FF4444"
          onPress={async () => {
            await Notifications.cancelAllScheduledNotificationsAsync();
            setScheduled([]);
          }}
        />

        <Text style={{ color: "#aaa", marginTop: 20 }}>
          Всего запланировано: {scheduled.length}
        </Text>

        {scheduled.map((n) => (
          <View key={n.identifier} style={{ marginTop: 8 }}>
            <Text style={{ color: "#ccc" }}>
              {n.content.title} — {n.content.body}
            </Text>
          </View>
        ))}

        {expoPushToken && (
          <Text style={{ color: "#888", marginTop: 20 }}>
            Expo Push Token (для сервера): {expoPushToken}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}




