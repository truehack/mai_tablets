import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { Screen } from "@/components/screen";
import { useNavigation } from "@react-navigation/native";
import { useDatabase, Medication } from "@/hooks/use-database";
import * as Notifications from "expo-notifications";

const daysOfWeek = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

// 🔔 вспомогательная функция для уведомлений за 10 минут до приёма
async function scheduleMedicationNotification(
  name: string,
  form: string,
  time: string,
  repeats: boolean
) {
  const [hour, minute] = time.split(":").map(Number);
  if (isNaN(hour) || isNaN(minute)) return;

  const now = new Date();
  const triggerTime = new Date();
  triggerTime.setHours(hour);
  triggerTime.setMinutes(minute - 10); // минус 10 минут
  triggerTime.setSeconds(0);

  // если уже прошло — переносим на завтра
  if (triggerTime <= now) {
    triggerTime.setDate(triggerTime.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💊 Скоро приём: ${name}`,
      body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
      sound: true,
    },
    trigger: repeats
      ? {
          hour: triggerTime.getHours(),
          minute: triggerTime.getMinutes(),
          repeats: true,
        }
      : { date: triggerTime },
  });

  console.log(`⏰ Уведомление создано для ${name} на ${triggerTime}`);
}

export default function Add() {
  const { addMedication } = useDatabase();
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [form, setForm] = useState<Medication["form"]>("tablet");
  const [startDate, setStartDate] = useState("");
  const [scheduleType, setScheduleType] =
    useState<Medication["schedule_type"]>("daily");
  const [timesList, setTimesList] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleAdd = async () => {
    if (!name || !form || !startDate || !scheduleType || !timesList) {
      alert("Пожалуйста, заполните все поля");
      return;
    }

    try {
      const med: Medication = {
        name,
        form,
        instructions: instructions || null,
        start_date: startDate,
        end_date: null,
        schedule_type: scheduleType,
        weekly_days: scheduleType === "weekly_days" ? selectedDays : null,
        interval_days: null,
        times_list: timesList.split(",").map((t) => t.trim()),
      };

      await addMedication(med);

      // ✅ Планируем уведомления сразу после добавления
      for (const time of med.times_list) {
        await scheduleMedicationNotification(
          med.name,
          med.form,
          time,
          med.schedule_type === "daily"
        );
      }

      alert("✅ Медикамент добавлен и уведомления запланированы!");
      navigation.goBack();
    } catch (e) {
      console.error("Ошибка при добавлении медикамента:", e);
      alert("Ошибка при сохранении медикамента");
    }
  };

  return (
    <Screen style={{ flex: 1, backgroundColor: "#121212", padding: 20 }}>
      <Text variant="titleLarge" style={{ marginBottom: 10, color: "white" }}>
        Добавить медикамент
      </Text>

      <TextInput
        label="Название"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={{ marginBottom: 8, backgroundColor: "#121212" }}
        textColor="white"
        outlineColor="#444"
        activeOutlineColor="#4A3AFF"
      />

      <TextInput
        label="Форма"
        value={form}
        onChangeText={setForm}
        mode="outlined"
        style={{ marginBottom: 8, backgroundColor: "#121212" }}
        textColor="white"
        outlineColor="#444"
        activeOutlineColor="#4A3AFF"
      />

      <TextInput
        label="Дата начала (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        mode="outlined"
        style={{ marginBottom: 8, backgroundColor: "#121212" }}
        textColor="white"
        outlineColor="#444"
        activeOutlineColor="#4A3AFF"
      />

      <TextInput
        label="Тип расписания (daily, weekly_days)"
        value={scheduleType}
        onChangeText={(val) =>
          setScheduleType(val as Medication["schedule_type"])
        }
        mode="outlined"
        style={{ marginBottom: 8, backgroundColor: "#121212" }}
        textColor="white"
        outlineColor="#444"
        activeOutlineColor="#4A3AFF"
      />

      {scheduleType === "weekly_days" && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          {daysOfWeek.map((day) => (
            <TouchableOpacity key={day} onPress={() => toggleDay(day)}>
              <View
                style={{
                  backgroundColor: selectedDays.includes(day)
                    ? "#4A3AFF"
                    : "#1E1E1E",
                  borderRadius: 25,
                  width: 36,
                  height: 36,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white" }}>{day}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TextInput
        label="Время приёма (08:00, 20:00)"
        value={timesList}
        onChangeText={setTimesList}
        mode="outlined"
        style={{ marginBottom: 8, backgroundColor: "#121212" }}
        textColor="white"
        outlineColor="#444"
        activeOutlineColor="#4A3AFF"
      />

      <TextInput
        label="Инструкции (по желанию)"
        value={instructions}
        onChangeText={setInstructions}
        mode="outlined"
        multiline
        style={{ marginBottom: 16, backgroundColor: "#121212" }}
        textColor="white"
        outlineColor="#444"
        activeOutlineColor="#4A3AFF"
      />

      <Button
        mode="contained"
        onPress={handleAdd}
        style={{ backgroundColor: "#4A3AFF" }}
      >
        Добавить
      </Button>
    </Screen>
  );
}




