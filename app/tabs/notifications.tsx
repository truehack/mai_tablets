// app/(tabs)/notifications.tsx
import React, { useState, useEffect } from "react";
import { View, ScrollView, Platform } from "react-native";
import { Button, Text } from "react-native-paper";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Screen } from "@/components/screen";
import { useDatabase } from "@/hooks/use-database";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// ✅ ИСПРАВЛЕННЫЙ обработчик уведомлений
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,    // ✅ Заменяет shouldShowAlert
    shouldShowList: true,      // ✅ Новый параметр
  }),
});

// ✅ ИСПРАВЛЕННАЯ функция планирования уведомлений
async function scheduleMedicationNotification(
  name: string,
  form: string,
  time: string,
  scheduleType: "daily" | "weekly_days" | "every_x_days",
  weeklyDays?: string[],
  intervalDays?: number,
  startDate?: string,
  endDate?: string
) {
  try {
    const [hours, minutes] = time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.warn(`⚠️ Неверное время: ${time}`);
      return;
    }

    const now = new Date();
    const end = endDate ? new Date(endDate) : null;
    
    // Если есть дата окончания и она уже прошла - не планируем
    if (end && now > new Date(end.setHours(23, 59, 59, 999))) {
      return;
    }

    // Функция для планирования одного уведомления на конкретную дату
    const scheduleForDate = async (targetDate: Date) => {
      // Создаём копию целевой даты
      const notificationDate = new Date(targetDate);
      
      // Устанавливаем время приёма лекарства
      notificationDate.setHours(hours, minutes, 0, 0);
      
      // Вычитаем 10 минут для уведомления
      const notificationTime = new Date(notificationDate.getTime() - 10 * 60 * 1000);
      
      // Если время уведомления уже прошло, пропускаем
      if (notificationTime <= now) {
        return;
      }
      
      // Проверяем, не выходит ли за пределы endDate
      if (end && notificationTime > new Date(end.setHours(23, 59, 59, 999))) {
        return;
      }

      console.log(`📅 Планируем уведомление: ${name} на ${notificationTime.toLocaleString('ru-RU')}`);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 Скоро приём: ${name}`,
          body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          ...(Platform.OS === "android" && {
            channelId: "reminders",
          }),
        },
        trigger: { date: notificationTime },
      });
    };

    if (scheduleType === "daily") {
      // Планируем на сегодня + следующие 7 дней
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + i);
        await scheduleForDate(targetDate);
      }
    } 
    else if (scheduleType === "weekly_days" && weeklyDays) {
      const dayIndexMap: Record<string, number> = {
        "ПН": 1, "ВТ": 2, "СР": 3, "ЧТ": 4, "ПТ": 5, "СБ": 6, "ВС": 0,
      };

      // Планируем на ближайшие 4 недели
      for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
        for (const day of weeklyDays) {
          const targetWeekday = dayIndexMap[day] ?? 1;
          const baseDate = new Date(now);
          baseDate.setDate(now.getDate() + weekOffset * 7);
          
          // Находим ближайшую дату с нужным днём недели
          const currentWeekday = baseDate.getDay();
          let daysToAdd = (targetWeekday - currentWeekday + 7) % 7;
          
          const targetDate = new Date(baseDate);
          targetDate.setDate(baseDate.getDate() + daysToAdd);
          
          await scheduleForDate(targetDate);
        }
      }
    } 
    else if (scheduleType === "every_x_days" && intervalDays && startDate) {
      const start = new Date(startDate);
      
      // Планируем ближайшие 10 приёмов
      for (let i = 0; i < 10; i++) {
        const targetDate = new Date(start);
        targetDate.setDate(start.getDate() + i * intervalDays);
        
        // Пропускаем даты в прошлом
        if (targetDate < new Date(now.setHours(0, 0, 0, 0))) {
          continue;
        }
        
        await scheduleForDate(targetDate);
      }
    }
  } catch (error) {
    console.error("❌ Ошибка планирования уведомления:", error);
  }
}

// ✅ Функция для получения всех будущих дат приёма лекарства
function getFutureMedicationDates(
  scheduleType: "daily" | "weekly_days" | "every_x_days",
  weeklyDays?: string[],
  intervalDays?: number,
  startDate?: string,
  daysAhead: number = 30
): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const start = startDate ? new Date(startDate) : now;

  if (scheduleType === "daily") {
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      if (date >= start) {
        dates.push(date);
      }
    }
  } 
  else if (scheduleType === "weekly_days" && weeklyDays) {
    const dayIndexMap: Record<string, number> = {
      "ПН": 1, "ВТ": 2, "СР": 3, "ЧТ": 4, "ПТ": 5, "СБ": 6, "ВС": 0,
    };
    
    for (let i = 0; i < daysAhead; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      
      if (date >= start) {
        const weekday = date.getDay();
        const dayName = Object.keys(dayIndexMap).find(key => dayIndexMap[key] === weekday);
        if (dayName && weeklyDays.includes(dayName)) {
          dates.push(date);
        }
      }
    }
  } 
  else if (scheduleType === "every_x_days" && intervalDays) {
    let currentDate = new Date(start);
    while (dates.length < 10 && currentDate <= new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)) {
      if (currentDate >= now) {
        dates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + intervalDays);
    }
  }

  return dates;
}

export default function NotificationsScreen() {
  const { getMedications } = useDatabase();
  const { expoPushToken } = usePushNotifications();
  const [scheduled, setScheduled] = useState<Notifications.NotificationRequest[]>([]);

  // Инициализация канала Android
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("reminders", {
        name: "Напоминания о приёме",
        importance: Notifications.AndroidImportance.HIGH,
        sound: true,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  }, []);

  // 📅 Планируем уведомления по данным из SQLite
  const scheduleAllMedNotifications = async () => {
    try {
      console.log("🔄 Запуск перепланировки уведомлений...");
      
      // Очистка старых уведомлений
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      const meds = await getMedications();
      console.log(`📋 Найдено лекарств: ${meds.length}`);

      let totalScheduled = 0;

      // Планирование для каждого лекарства
      for (const med of meds) {
        const times = Array.isArray(med.times_list)
          ? med.times_list
          : typeof med.times_list === "string"
          ? JSON.parse(med.times_list)
          : [];

        console.log(`💊 Лекарство: ${med.name}, время приёма: ${times.join(', ')}`);

        for (const time of times) {
          await scheduleMedicationNotification(
            med.name,
            med.form,
            time,
            med.schedule_type,
            med.schedule_type === "weekly_days" ? med.weekly_days : undefined,
            med.schedule_type === "every_x_days" ? med.interval_days : undefined,
            med.start_date,
            med.end_date
          );
          totalScheduled++;
        }
      }

      // Сохраняем время последней планировки
      await AsyncStorage.setItem("lastScheduled", Date.now().toString());

      // Получаем список запланированных уведомлений
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      setScheduled(allScheduled);
      
      console.log(`✅ Успешно запланировано уведомлений: ${allScheduled.length}`);
      console.log(`📊 Попыток планирования: ${totalScheduled}`);

    } catch (error) {
      console.error("💥 Ошибка при планировании:", error);
    }
  };

  // Автопланировка при монтировании
  useEffect(() => {
    scheduleAllMedNotifications();
  }, []);

  return (
    <Screen
      style={{
        flex: 1,
        backgroundColor: "#121212",
        paddingHorizontal: 16,
        paddingTop: 20,
      }}
    >
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}>
        <Text style={{ color: "white", fontSize: 18, marginBottom: 20, textAlign: "center" }}>
          Уведомления о приёме лекарств
        </Text>

        <Button
          mode="contained"
          onPress={scheduleAllMedNotifications}
          style={{ marginBottom: 12, width: "80%" }}
        >
          Перепланировать уведомления
        </Button>

        <Button
          mode="outlined"
          textColor="#FF4444"
          onPress={async () => {
            await Notifications.cancelAllScheduledNotificationsAsync();
            setScheduled([]);
            await AsyncStorage.setItem("lastScheduled", "0");
          }}
          style={{ marginBottom: 20, width: "80%" }}
        >
          Очистить ВСЕ уведомления
        </Button>

        <Text style={{ color: "#aaa", fontSize: 16, marginBottom: 16 }}>
          Запланировано: <Text style={{ color: "white" }}>{scheduled.length}</Text>
        </Text>

        {scheduled.length === 0 ? (
          <Text style={{ color: "#777", textAlign: "center", marginVertical: 20 }}>
            Нет активных уведомлений
          </Text>
        ) : (
          scheduled.slice(0, 10).map((n) => {
            const triggerDate = (n.trigger as any)?.date 
              ? new Date((n.trigger as any).date).toLocaleString('ru-RU')
              : '—';
            return (
              <View key={n.identifier} style={{ 
                backgroundColor: '#1E1E1E', 
                borderRadius: 8, 
                padding: 12, 
                marginVertical: 4,
                width: "90%",
                borderWidth: 1,
                borderColor: '#333'
              }}>
                <Text style={{ color: "#fff", fontWeight: "bold" }}>{n.content.title}</Text>
                <Text style={{ color: "#ccc", fontSize: 13, marginTop: 4 }}>
                  {n.content.body}
                </Text>
                <Text style={{ color: "#888", fontSize: 11, marginTop: 4 }}>
                  🕒 {triggerDate}
                </Text>
              </View>
            );
          })
        )}

        {expoPushToken && (
          <Text style={{ 
            color: "#888", 
            marginTop: 30, 
            fontSize: 12,
            textAlign: "center",
            paddingHorizontal: 20
          }}>
            Expo Push Token (для сервера): {expoPushToken.substring(0, 20)}...
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}