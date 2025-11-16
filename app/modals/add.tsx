// app/modals/add.tsx

import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import {
  Button,
  Text,
  TextInput,
  Menu,
  Divider,
  Portal,
} from "react-native-paper";
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
  scheduleType: Medication['schedule_type'],
  weeklyDays?: string[],
  intervalDays?: number,
  startDate?: string
) {
  const [hour, minute] = time.split(":").map(Number);
  if (isNaN(hour) || isNaN(minute)) {
    console.log(`⏰ Ошибка: время ${time} некорректно`);
    return;
  }

  // Вычисляем время уведомления: за 10 минут до приёма
  let notificationHour = hour;
  let notificationMinute = minute - 10;

  // Если минуты < 0 — переносим на предыдущий час
  if (notificationMinute < 0) {
    notificationMinute += 60;
    notificationHour -= 1;
    // Если час < 0 — переносим на предыдущий день
    if (notificationHour < 0) {
      notificationHour = 23;
    }
  }

  // Если тип — daily
  if (scheduleType === 'daily') {
    const now = new Date();
    const triggerTime = new Date();
    triggerTime.setHours(notificationHour);
    triggerTime.setMinutes(notificationMinute);
    triggerTime.setSeconds(0);

    // Если время уже прошло — переносим на завтра
    if (triggerTime <= now) {
      triggerTime.setDate(triggerTime.getDate() + 1);
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 Скоро приём: ${name}`,
          body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
          sound: true,
        },
        trigger: {
          date: triggerTime,
        },
      });
      console.log(`⏰ Уведомление запланировано для ${name} на ${triggerTime}`);
    } catch (e) {
      console.error(`❌ Ошибка при планировании уведомления для ${name}:`, e);
    }
  } else if (scheduleType === 'weekly_days' && weeklyDays) {
    // Планируем уведомления на конкретные дни недели
    for (const day of weeklyDays) {
      const now = new Date();
      const triggerTime = new Date();
      triggerTime.setHours(notificationHour);
      triggerTime.setMinutes(notificationMinute);
      triggerTime.setSeconds(0);

      // Если время уже прошло — переносим на завтра
      if (triggerTime <= now) {
        triggerTime.setDate(triggerTime.getDate() + 1);
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💊 Скоро приём: ${name}`,
            body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
            sound: true,
          },
          trigger: {
            date: triggerTime,
          },
        });
        console.log(`⏰ Уведомление запланировано для ${name} на ${day} в ${triggerTime}`);
      } catch (e) {
        console.error(`❌ Ошибка при планировании уведомления для ${name} на ${day}:`, e);
      }
    }
  } else if (scheduleType === 'every_x_days' && intervalDays && startDate) {
    // Планируем уведомления на дни, кратные intervalDays, начиная с startDate
    const start = new Date(startDate);
    const today = new Date();
    const diffMs = today.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let nextDayOffset = intervalDays - (diffDays % intervalDays);
    if (nextDayOffset === intervalDays) nextDayOffset = 0; // если сегодня совпадает

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + nextDayOffset);

    // Планируем на ближайшую дату и далее с интервалом
    let current = new Date(nextDate);
    for (let i = 0; i < 10; i++) { // планируем на 10 уведомлений вперёд
      const triggerTime = new Date(current);
      triggerTime.setHours(notificationHour);
      triggerTime.setMinutes(notificationMinute);
      triggerTime.setSeconds(0);

      // Если время уже прошло сегодня — переносим на следующий день
      const now = new Date();
      if (triggerTime <= now) {
        triggerTime.setDate(triggerTime.getDate() + 1);
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💊 Скоро приём: ${name}`,
            body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
            sound: true,
          },
          trigger: {
            date: triggerTime,
          },
        });
        console.log(`⏰ Уведомление запланировано для ${name} на ${triggerTime}`);
      } catch (e) {
        console.error(`❌ Ошибка при планировании уведомления для ${name} на ${triggerTime}:`, e);
      }

      current.setDate(current.getDate() + intervalDays);
    }
  }
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
  const [intervalDays, setIntervalDays] = useState<string>(""); // ✅ Новое поле

  // ✅ Состояния для ошибок
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [startDateError, setStartDateError] = useState("");
  const [scheduleTypeError, setScheduleTypeError] = useState("");
  const [timesListError, setTimesListError] = useState("");
  const [intervalDaysError, setIntervalDaysError] = useState("");
  const [selectedDaysError, setSelectedDaysError] = useState("");

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // ✅ Валидация времени HH:MM
  const validateTime = (time: string): boolean => {
    if (!time) return false;
    const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return regex.test(time.trim());
  };

  // ✅ Валидация даты ДД.ММ.ГГГГ (без строгой проверки существования)
  const validateDate = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    if (!regex.test(dateStr)) return false;

    const parts = dateStr.split('.');
    if (parts.length !== 3) return false;

    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

    // Проверяем, что день и месяц в допустимых пределах
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;

    return true;
  };

  // ✅ Валидация интервала (число от 1 до 30)
  const validateInterval = (str: string): boolean => {
    if (!str) return false;
    const num = parseInt(str, 10);
    return !isNaN(num) && num >= 1 && num <= 30;
  };

  // ✅ Сброс ошибок
  const resetErrors = () => {
    setNameError("");
    setFormError("");
    setStartDateError("");
    setScheduleTypeError("");
    setTimesListError("");
    setIntervalDaysError("");
    setSelectedDaysError("");
  };

  const handleAdd = async () => {
    resetErrors();
    let hasErrors = false;

    if (!name) {
      setNameError("Поле обязательно");
      hasErrors = true;
    }

    if (!form) {
      setFormError("Поле обязательно");
      hasErrors = true;
    }

    if (!startDate) {
      setStartDateError("Поле обязательно");
      hasErrors = true;
    } else if (!validateDate(startDate)) {
      setStartDateError("Формат: ДД.ММ.ГГГГ, например 13.11.2025");
      hasErrors = true;
    }

    if (!scheduleType) {
      setScheduleTypeError("Поле обязательно");
      hasErrors = true;
    }

    if (!timesList) {
      setTimesListError("Поле обязательно");
      hasErrors = true;
    } else {
      const times = timesList.split(",").map(t => t.trim());
      for (const time of times) {
        if (!validateTime(time)) {
          setTimesListError(`Неверный формат времени: ${time}. Используйте ЧЧ:ММ`);
          hasErrors = true;
          break;
        }
      }
    }

    if (scheduleType === "every_x_days") {
      if (!intervalDays) {
        setIntervalDaysError("Поле обязательно");
        hasErrors = true;
      } else if (!validateInterval(intervalDays)) {
        setIntervalDaysError("Введите число от 1 до 30");
        hasErrors = true;
      }
    }

    if (scheduleType === "weekly_days" && selectedDays.length === 0) {
      setSelectedDaysError("Выберите хотя бы один день");
      hasErrors = true;
    }

    if (hasErrors) return;

    // Конвертируем дату в YYYY-MM-DD
    const [day, month, year] = startDate.split('.').map(Number);
    const convertedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    try {
      const med: Medication = {
        name,
        form,
        instructions: instructions || null,
        start_date: convertedDate,
        end_date: null,
        schedule_type: scheduleType,
        weekly_days: scheduleType === "weekly_days" ? selectedDays : null,
        interval_days: scheduleType === "every_x_days" ? parseInt(intervalDays, 10) : null,
        times_list: timesList.split(",").map((t) => t.trim()),
      };

      await addMedication(med);

      // ✅ Планируем уведомления сразу после добавления
      for (const time of med.times_list) {
        await scheduleMedicationNotification(
          med.name,
          med.form,
          time,
          med.schedule_type,
          med.weekly_days,
          med.interval_days,
          med.start_date
        );
      }

      alert("✅ Медикамент добавлен и уведомления запланированы!");
      navigation.goBack();
    } catch (e) {
      console.error("Ошибка при добавлении медикамента:", e);
      alert("Ошибка при сохранении медикамента");
    }
  };

  // Для формы
  const [formVisible, setFormVisible] = useState(false);
  const formItems = [
    { label: "Таблетка", value: "tablet" },
    { label: "Капли", value: "drop" },
    { label: "Спрей", value: "spray" },
  ];

  // Для типа расписания
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const scheduleItems = [
    { label: "Ежедневно", value: "daily" },
    { label: "По дням недели", value: "weekly_days" },
    { label: "Каждые X дней", value: "every_x_days" },
  ];

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
        error={!!nameError}
      />
      {nameError ? <Text style={{ color: "#FF3B30", fontSize: 12, marginBottom: 8 }}>{nameError}</Text> : null}

      {/* Выбор формы */}
      <Menu
        key={`form-menu-${formVisible}`}
        visible={formVisible}
        onDismiss={() => setFormVisible(false)}
        anchor={
          <TextInput
            label="Форма"
            value={
              form === "tablet" ? "Таблетка" :
              form === "drop" ? "Капли" :
              form === "spray" ? "Спрей" : "Другое"
            }
            mode="outlined"
            style={{ marginBottom: 8, backgroundColor: "#121212" }}
            textColor="white"
            outlineColor="#444"
            activeOutlineColor="#4A3AFF"
            editable={false}
            onPress={() => setFormVisible(true)}
            error={!!formError}
          />
        }
      >
        {formItems.map((item) => (
          <Menu.Item
            key={item.value}
            title={item.label}
            onPress={() => {
              setForm(item.value);
              setFormVisible(false);
            }}
          />
        ))}
      </Menu>
      {formError ? <Text style={{ color: "#FF3B30", fontSize: 12, marginBottom: 8 }}>{formError}</Text> : null}

      <TextInput
        label="Дата начала (ДД.ММ.ГГГГ)"
        value={startDate}
        onChangeText={setStartDate}
        mode="outlined"
        style={{ marginBottom: 8, backgroundColor: "#121212" }}
        textColor="white"
        outlineColor="#444"
        activeOutlineColor="#4A3AFF"
        error={!!startDateError}
      />
      {startDateError ? <Text style={{ color: "#FF3B30", fontSize: 12, marginBottom: 8 }}>{startDateError}</Text> : null}

      {/* Выбор типа расписания */}
      <Menu
        key={`schedule-menu-${scheduleVisible}`}
        visible={scheduleVisible}
        onDismiss={() => setScheduleVisible(false)}
        anchor={
          <TextInput
            label="Тип расписания"
            value={
              scheduleType === "daily" ? "Ежедневно" :
              scheduleType === "weekly_days" ? "По дням недели" :
              "Каждые X дней"
            }
            mode="outlined"
            style={{ marginBottom: 8, backgroundColor: "#121212" }}
            textColor="white"
            outlineColor="#444"
            activeOutlineColor="#4A3AFF"
            editable={false}
            onPress={() => setScheduleVisible(true)}
            error={!!scheduleTypeError}
          />
        }
      >
        {scheduleItems.map((item) => (
          <Menu.Item
            key={item.value}
            title={item.label}
            onPress={() => {
              setScheduleType(item.value);
              setScheduleVisible(false);
            }}
          />
        ))}
      </Menu>
      {scheduleTypeError ? <Text style={{ color: "#FF3B30", fontSize: 12, marginBottom: 8 }}>{scheduleTypeError}</Text> : null}

      {/* Поле для интервала, если выбран "Каждые X дней" */}
      {scheduleType === "every_x_days" && (
        <>
          <TextInput
            label="Каждые X дней"
            value={intervalDays}
            onChangeText={setIntervalDays}
            mode="outlined"
            keyboardType="numeric"
            style={{ marginBottom: 8, backgroundColor: "#121212" }}
            textColor="white"
            outlineColor="#444"
            activeOutlineColor="#4A3AFF"
            error={!!intervalDaysError}
          />
          {intervalDaysError ? <Text style={{ color: "#FF3B30", fontSize: 12, marginBottom: 8 }}>{intervalDaysError}</Text> : null}
        </>
      )}

      {scheduleType === "weekly_days" && (
        <>
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
          {selectedDaysError ? <Text style={{ color: "#FF3B30", fontSize: 12, marginBottom: 8 }}>{selectedDaysError}</Text> : null}
        </>
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
        error={!!timesListError}
      />
      {timesListError ? <Text style={{ color: "#FF3B30", fontSize: 12, marginBottom: 8 }}>{timesListError}</Text> : null}

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