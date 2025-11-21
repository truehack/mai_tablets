// app/modals/add.tsx

import React, { useState, useCallback, useRef, useEffect } from "react";
import { 
  View, 
  TouchableOpacity, 
  Animated, 
  LayoutAnimation, 
  UIManager,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Platform 
} from "react-native";
import {
  Button,
  Text,
  TextInput,
  Menu,
  HelperText,
  useTheme,
  Snackbar
} from "react-native-paper";
import { Screen } from "@/components/screen";
import { useNavigation } from "@react-navigation/native";
import { useDatabase, Medication } from "@/hooks/use-database";
import * as Notifications from "expo-notifications";
import apiClient from "@/services/api";
import { getLocalUser } from "@/services/localUser.service";

// Включаем LayoutAnimation для Android
if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const daysOfWeek = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

// ✅ ФИКС ЧАСОВОГО ПОЯСА — универсальная функция
const localDateToUtcTimestamp = (localDate: Date): number => {
  return Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    localDate.getHours(),
    localDate.getMinutes(),
    localDate.getSeconds(),
    localDate.getMilliseconds()
  );
};

// ✅ ПОЛНОСТЬЮ СОВМЕСТИМ С 1-М ФАЙЛОМ: 10 уведомлений для every_x_days + –1d в БД
async function scheduleMedicationNotification(
  name: string,
  form: string,
  time: string,
  scheduleType: Medication["schedule_type"],
  weeklyDays?: string[],
  intervalDays?: number,
  startDate?: string // ← ожидается оригинальная дата (без –1d)
) {
  const [hour, minute] = time.split(":").map(Number);
  if (isNaN(hour) || isNaN(minute)) {
    console.log(`⏰ Ошибка: время ${time} некорректно`);
    return;
  }

  // Вычисляем время уведомления: за 10 минут до приёма
  let notificationHour = hour;
  let notificationMinute = minute - 10;

  if (notificationMinute < 0) {
    notificationMinute += 60;
    notificationHour -= 1;
    if (notificationHour < 0) {
      notificationHour = 23;
    }
  }

  const now = new Date();

  if (scheduleType === 'daily') {
    const triggerTime = new Date();
    triggerTime.setHours(notificationHour);
    triggerTime.setMinutes(notificationMinute);
    triggerTime.setSeconds(0);

    if (triggerTime <= now) {
      triggerTime.setDate(triggerTime.getDate() + 1);
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 Скоро приём: ${name}`,
          body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: "#4A3AFF",
        },
        trigger: { date: localDateToUtcTimestamp(triggerTime) },
      });
      console.log(`⏰ Уведомление запланировано для ${name} на ${triggerTime}`);
    } catch (e) {
      console.error(`❌ Ошибка при планировании уведомления для ${name}:`, e);
    }
  } 
  else if (scheduleType === 'weekly_days' && weeklyDays) {
    for (const day of weeklyDays) {
      const triggerTime = new Date();
      triggerTime.setHours(notificationHour);
      triggerTime.setMinutes(notificationMinute);
      triggerTime.setSeconds(0);

      if (triggerTime <= now) {
        triggerTime.setDate(triggerTime.getDate() + 1);
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `💊 Скоро приём: ${name}`,
            body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            color: "#4A3AFF",
          },
          trigger: { date: localDateToUtcTimestamp(triggerTime) },
        });
        console.log(`⏰ Уведомление запланировано для ${name} на ${day} в ${triggerTime}`);
      } catch (e) {
        console.error(`❌ Ошибка при планировании уведомления для ${name} на ${day}:`, e);
      }
    }
  } 
  else if (scheduleType === 'every_x_days' && intervalDays && startDate) {
    const start = new Date(startDate);
    const today = new Date();
    const diffMs = today.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let nextDayOffset = intervalDays - (diffDays % intervalDays);
    if (nextDayOffset === intervalDays) nextDayOffset = 0;

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + nextDayOffset);

    let current = new Date(nextDate);
    for (let i = 0; i < 10; i++) {
      const triggerTime = new Date(current);
      triggerTime.setHours(notificationHour);
      triggerTime.setMinutes(notificationMinute);
      triggerTime.setSeconds(0);

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
            priority: Notifications.AndroidNotificationPriority.HIGH,
            color: "#4A3AFF",
          },
          trigger: { date: localDateToUtcTimestamp(triggerTime) },
        });
        console.log(`⏰ Уведомление запланировано для ${name} на ${triggerTime}`);
      } catch (e) {
        console.error(`❌ Ошибка при планировании уведомления для ${name} на ${triggerTime}:`, e);
      }

      current.setDate(current.getDate() + intervalDays);
    }
  }
}

// 🔁 Маппинг: "ПН" → 1, ..., "ВС" → 7
const mapDayToNumber = (day: string): number => {
  const map: Record<string, number> = {
    "ПН": 1, "ВТ": 2, "СР": 3, "ЧТ": 4, "ПТ": 5, "СБ": 6, "ВС": 7
  };
  return map[day] ?? 1;
};

// 🔁 Формат времени: "08:00" → "08:00:00"
const formatTimeForServer = (timeStr: string): string => {
  if (timeStr.length === 5 && timeStr[2] === ":") {
    return `${timeStr}:00`;
  }
  return timeStr;
};

// ✅ Автоформатирование даты: "20112025" → "20.11.2025"
const formatDateString = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
};

// ✅ Валидация даты ДД.ММ.ГГГГ (без строгой проверки)
const validateDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  if (!regex.test(dateStr)) return false;

  const parts = dateStr.split('.');
  if (parts.length !== 3) return false;

  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;

  return day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100;
};

// ✅ Валидация времени HH:MM
const validateTime = (time: string): boolean => {
  if (!time) return false;
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(time.trim());
};

// ✅ Валидация интервала (число от 1 до 30)
const validateInterval = (str: string): boolean => {
  if (!str) return false;
  const num = parseInt(str, 10);
  return !isNaN(num) && num >= 1 && num <= 30;
};

export default function Add() {
  const { addMedication, updateMedicationServerId } = useDatabase();
  const navigation = useNavigation();
  const theme = useTheme();

  // Анимации
  const formOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'warning' | 'error'>('success');

  const [name, setName] = useState("");
  const [form, setForm] = useState<Medication["form"]>("tablet");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(""); // ✅ необязательное
  const [scheduleType, setScheduleType] = useState<Medication["schedule_type"]>("daily");
  const [timesList, setTimesList] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [intervalDays, setIntervalDays] = useState("");

  // ✅ Ошибки — точно как в 1-м файле
  const [nameError, setNameError] = useState("");
  const [formError, setFormError] = useState("");
  const [startDateError, setStartDateError] = useState("");
  const [endDateError, setEndDateError] = useState("");
  const [scheduleTypeError, setScheduleTypeError] = useState("");
  const [timesListError, setTimesListError] = useState("");
  const [intervalDaysError, setIntervalDaysError] = useState("");
  const [selectedDaysError, setSelectedDaysError] = useState("");

  const startDateRef = useRef<TextInput>(null);
  const endDateRef = useRef<TextInput>(null);

  // Анимация появления
  useEffect(() => {
    Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ✅ Валидация — ТОЧНО КАК В 1-М ФАЙЛЕ
  const validate = () => {
    setNameError("");
    setFormError("");
    setStartDateError("");
    setEndDateError("");
    setScheduleTypeError("");
    setTimesListError("");
    setIntervalDaysError("");
    setSelectedDaysError("");

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

    // ✅ endDate — НЕОБЯЗАТЕЛЬНОЕ, но если введено — проверяем
    if (endDate && !validateDate(endDate)) {
      setEndDateError("Формат: ДД.ММ.ГГГГ, например 13.11.2025");
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

    return !hasErrors;
  };

  // ✅ ИСПРАВЛЕННЫЙ handleAdd — корректная обработка endDate
  const handleAdd = useCallback(async () => {
    if (!validate()) return;

    LayoutAnimation.configureNext({
      duration: 150,
      create: { type: LayoutAnimation.Types.easeInEaseOut },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });

    Keyboard.dismiss();

    // --- Парсинг startDate (обязательная) ---
    let convertedStartDate: string;
    try {
      const parts = startDate.split('.');
      if (parts.length !== 3) throw new Error("Invalid format");
      const [dd, mm, yyyy] = parts.map(Number);
      if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) throw new Error("NaN parts");
      convertedStartDate = `${yyyy}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`;
    } catch (e) {
      console.error("❌ Ошибка парсинга startDate:", startDate, e);
      setSnackbarMessage('Некорректная дата начала');
      setSnackbarType('error');
      setSnackbarVisible(true);
      return;
    }

    // ✅ СМЕЩЕНИЕ –1 ДЕНЬ для БД и сервера
    const startDateMinus1d = (() => {
      const d = new Date(convertedStartDate);
      if (isNaN(d.getTime())) {
        throw new Error("Invalid date");
      }
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    })();

    // --- Парсинг endDate (необязательная) ---
    let convertedEndDate: string | null = null;
    if (endDate.trim()) {
      try {
        const parts = endDate.split('.');
        if (parts.length !== 3) throw new Error("Invalid format");
        const [dd, mm, yyyy] = parts.map(Number);
        if (isNaN(dd) || isNaN(mm) || isNaN(yyyy)) throw new Error("NaN parts");
        convertedEndDate = `${yyyy}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`;
      } catch (e) {
        console.error("❌ Ошибка парсинга endDate:", endDate, e);
        setSnackbarMessage('Некорректная дата окончания');
        setSnackbarType('error');
        setSnackbarVisible(true);
        return;
      }
    }

    try {
      const med: Medication = {
        name,
        form,
        instructions: instructions || null,
        start_date: startDateMinus1d,   // ← –1 день
        end_date: convertedEndDate,     // ← null или строка
        schedule_type: scheduleType,
        weekly_days: scheduleType === "weekly_days" ? selectedDays : null,
        interval_days: scheduleType === "every_x_days" ? parseInt(intervalDays, 10) : null,
        times_list: timesList.split(",").map((t) => t.trim()),
      };

      const localId = await addMedication(med);

      // ✅ Уведомления — по оригинальной startDate (без смещения!)
      for (const time of med.times_list) {
        await scheduleMedicationNotification(
          med.name,
          med.form,
          time,
          med.schedule_type,
          med.weekly_days,
          med.interval_days,
          convertedStartDate // ← важно: оригинальная дата
        );
      }

      // ——— СИНХРОНИЗАЦИЯ С СЕРВЕРОМ ———
      try {
        const user = await getLocalUser();
        if (!user) throw new Error("Пользователь не авторизован");

        const serverPayload: Record<string, any> = {
          name: med.name,
          form: med.form,
          instructions: med.instructions,
          start_date: med.start_date, // ← –1 день
          schedule_type: med.schedule_type,
          times_per_day: med.times_list.map(formatTimeForServer),
        };

        // ✅ Передаём end_date ТОЛЬКО если есть
        if (convertedEndDate) {
          serverPayload.end_date = convertedEndDate;
        }

        // ✅ Доп. поля по типу расписания
        if (med.schedule_type === "weekly_days" && med.weekly_days) {
          serverPayload.week_days = med.weekly_days.map(mapDayToNumber);
        } else if (med.schedule_type === "every_x_days" && med.interval_days) {
          serverPayload.interval_days = med.interval_days;
        }

        const serverResponse = await apiClient.postWithAuth(
          "/medicines/add_medication",
          serverPayload
        );

        if (serverResponse.id) {
          await updateMedicationServerId(localId, serverResponse.id);
        }

        setSnackbarMessage('✅ Медикамент добавлен и уведомления запланированы!');
        setSnackbarType('success');
        setSnackbarVisible(true);

        setTimeout(() => {
          Animated.timing(formOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            navigation.goBack();
          });
        }, 1500);

      } catch (syncError: any) {
        console.warn("⚠️ Синхронизация отложена:", syncError.message);
        setSnackbarMessage('✅ Сохранено локально. Синхронизация отложена.');
        setSnackbarType('warning');
        setSnackbarVisible(true);
        
        setTimeout(() => {
          Animated.timing(formOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            navigation.goBack();
          });
        }, 1500);
      }

    } catch (e: any) {
      console.error("❌ Ошибка добавления:", e);
      setSnackbarMessage(e.message || 'Не удалось добавить медикамент');
      setSnackbarType('error');
      setSnackbarVisible(true);
    }
  }, [
    name, form, startDate, endDate, scheduleType, timesList,
    instructions, selectedDays, intervalDays,
    addMedication, updateMedicationServerId, navigation
  ]);

  const [formVisible, setFormVisible] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const AnimatedDayButton = ({ day, isSelected }: { day: string; isSelected: boolean }) => {
    const scale = useRef(new Animated.Value(isSelected ? 1.1 : 1)).current;
    const backgroundColor = isSelected ? '#4A3AFF' : '#2D2D2D';
    const textColor = isSelected ? 'white' : '#aaa';

    useEffect(() => {
      Animated.spring(scale, {
        toValue: isSelected ? 1.1 : 1,
        friction: 5,
        tension: 150,
        useNativeDriver: true,
      }).start();
    }, [isSelected]);

    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          onPress={() => toggleDay(day)}
          activeOpacity={0.8}
        >
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: isSelected ? '#4A3AFF' : 'transparent',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isSelected ? 0.3 : 0,
            shadowRadius: 4,
          }}>
            <Text style={{ 
              color: textColor,
              fontWeight: '600',
              fontSize: 14,
            }}>
              {day}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#121212' }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Screen style={{ flex: 1, padding: 20, backgroundColor: '#121212' }}>
          <Animated.View
            style={{
              flex: 1,
              opacity: formOpacity,
              transform: [{ translateY: contentTranslateY }],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(74, 58, 255, 0.15)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Text style={{ fontSize: 20 }}>💊</Text>
              </View>
              <Text variant="headlineSmall" style={{ color: '#fff', fontWeight: '700' }}>
                Добавить медикамент
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <AnimatedTextInput
                label="Название"
                value={name}
                onChangeText={setName}
                mode="outlined"
                error={!!nameError}
                style={{ marginBottom: 8 }}
                icon="pill"
                autoFocus
              />
              {nameError ? <HelperText type="error">{nameError}</HelperText> : null}

              <Menu
                visible={formVisible}
                onDismiss={() => setFormVisible(false)}
                anchor={
                  <AnimatedTextInput
                    label="Форма"
                    value={
                      form === "tablet" ? "Таблетка" :
                      form === "drop" ? "Капли" :
                      form === "spray" ? "Спрей" : "Другое"
                    }
                    mode="outlined"
                    editable={false}
                    onPress={() => setFormVisible(true)}
                    error={!!formError}
                    style={{ marginBottom: 8 }}
                    icon="cube-outline"
                  />
                }
              >
                {[
                  { label: "Таблетка", value: "tablet", icon: "pill" },
                  { label: "Капли", value: "drop", icon: "water" },
                  { label: "Спрей", value: "spray", icon: "spray" },
                ].map(item => (
                  <Menu.Item
                    key={item.value}
                    title={item.label}
                    leftIcon={item.icon}
                    onPress={() => {
                      setForm(item.value as Medication["form"]);
                      setFormVisible(false);
                    }}
                    titleStyle={{ color: '#fff' }}
                  />
                ))}
              </Menu>
              {formError ? <HelperText type="error">{formError}</HelperText> : null}

              <AnimatedTextInput
                ref={startDateRef}
                label="Дата начала (ДД.ММ.ГГГГ)"
                value={startDate}
                onChangeText={(text) => setStartDate(formatDateString(text))}
                keyboardType="numeric"
                maxLength={10}
                mode="outlined"
                error={!!startDateError}
                style={{ marginBottom: 8 }}
                icon="calendar-start"
                onSubmitEditing={() => endDateRef.current?.focus()}
              />
              {startDateError ? <HelperText type="error">{startDateError}</HelperText> : null}

              {/* ✅ endDate — НЕОБЯЗАТЕЛЬНОЕ */}
              <AnimatedTextInput
                ref={endDateRef}
                label="Дата окончания (ДД.ММ.ГГГГ, по желанию)"
                value={endDate}
                onChangeText={(text) => setEndDate(formatDateString(text))}
                keyboardType="numeric"
                maxLength={10}
                mode="outlined"
                error={!!endDateError}
                style={{ marginBottom: 8 }}
                icon="calendar-end"
              />
              {endDateError ? <HelperText type="error">{endDateError}</HelperText> : null}

              <Menu
                visible={scheduleVisible}
                onDismiss={() => setScheduleVisible(false)}
                anchor={
                  <AnimatedTextInput
                    label="Тип расписания"
                    value={
                      scheduleType === "daily" ? "Ежедневно" :
                      scheduleType === "weekly_days" ? "По дням недели" :
                      "Каждые X дней"
                    }
                    mode="outlined"
                    editable={false}
                    onPress={() => setScheduleVisible(true)}
                    error={!!scheduleTypeError}
                    style={{ marginBottom: 8 }}
                    icon="clock-outline"
                  />
                }
              >
                {[
                  { label: "Ежедневно", value: "daily", icon: "calendar-month" },
                  { label: "По дням недели", value: "weekly_days", icon: "calendar-week" },
                  { label: "Каждые X дней", value: "every_x_days", icon: "calendar-sync" },
                ].map(item => (
                  <Menu.Item
                    key={item.value}
                    title={item.label}
                    leftIcon={item.icon}
                    onPress={() => {
                      setScheduleType(item.value as Medication["schedule_type"]);
                      setScheduleVisible(false);
                    }}
                    titleStyle={{ color: '#fff' }}
                  />
                ))}
              </Menu>
              {scheduleTypeError ? <HelperText type="error">{scheduleTypeError}</HelperText> : null}

              {scheduleType === "every_x_days" && (
                <>
                  <AnimatedTextInput
                    label="Каждые X дней"
                    value={intervalDays}
                    onChangeText={setIntervalDays}
                    mode="outlined"
                    keyboardType="numeric"
                    error={!!intervalDaysError}
                    style={{ marginBottom: 8 }}
                    icon="numeric"
                  />
                  {intervalDaysError ? <HelperText type="error">{intervalDaysError}</HelperText> : null}
                </>
              )}

              {scheduleType === "weekly_days" && (
                <View style={{ 
                  flexDirection: "row", 
                  justifyContent: "space-between", 
                  marginBottom: 12,
                  backgroundColor: 'rgba(30, 41, 59, 0.4)',
                  padding: 16,
                  borderRadius: 14,
                }}>
                  {daysOfWeek.map(day => (
                    <AnimatedDayButton 
                      key={day} 
                      day={day} 
                      isSelected={selectedDays.includes(day)} 
                    />
                  ))}
                </View>
              )}
              {selectedDaysError ? <HelperText type="error">{selectedDaysError}</HelperText> : null}

              <AnimatedTextInput
                label="Время приёма (08:00, 20:00)"
                value={timesList}
                onChangeText={setTimesList}
                mode="outlined"
                error={!!timesListError}
                style={{ marginBottom: 8 }}
                icon="clock-time-four-outline"
                multiline
              />
              {timesListError ? <HelperText type="error">{timesListError}</HelperText> : null}

              <AnimatedTextInput
                label="Инструкции (по желанию)"
                value={instructions}
                onChangeText={setInstructions}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={{ marginBottom: 16 }}
                icon="note-text-outline"
              />

              <Animated.View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={handleAdd}
                  activeOpacity={0.8}
                >
                  <Animated.View
                    style={{
                      backgroundColor: '#4A3AFF',
                      paddingHorizontal: 24,
                      paddingVertical: 14,
                      borderRadius: 16,
                      shadowColor: '#4A3AFF',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                      Добавить
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          <Snackbar
            visible={snackbarVisible}
            onDismiss={() => setSnackbarVisible(false)}
            duration={2500}
            style={{
              backgroundColor:
                snackbarType === 'success'
                  ? '#252D25'
                  : snackbarType === 'warning'
                  ? '#2D2B25'
                  : '#2D2525',
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                color:
                  snackbarType === 'success'
                    ? '#6EE7B7'
                    : snackbarType === 'warning'
                    ? '#FBBF24'
                    : '#FCA5A5',
                fontWeight: '500',
              }}
            >
              {snackbarMessage}
            </Text>
          </Snackbar>
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Компонент AnimatedTextInput — с иконками и анимацией
const AnimatedTextInput = React.forwardRef(({ 
  label, 
  value, 
  onChangeText, 
  mode, 
  error, 
  style, 
  icon,
  ...props 
}: any, ref: any) => {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handleFocus = () => {
    Animated.spring(scale, {
      toValue: 1.02,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const handleBlur = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TextInput
        ref={ref}
        label={label}
        value={value}
        onChangeText={onChangeText}
        mode={mode}
        error={error}
        style={[style, { 
          backgroundColor: '#1E1E1E',
          borderColor: error ? '#EF4444' : '#323232',
        }]}
        left={icon && <TextInput.Icon icon={icon} color={error ? '#EF4444' : '#888'} />}
        theme={{
          colors: {
            primary: error ? '#EF4444' : '#4A3AFF',
            text: '#fff',
            placeholder: '#888',
            background: '#1E1E1E',
          },
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        selectionColor="#4A3AFF"
        {...props}
      />
    </Animated.View>
  );
});