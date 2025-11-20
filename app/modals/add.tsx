// app/modals/add.tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { 
  View, 
  TouchableOpacity, 
  Alert, 
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

// ✅ ФИКС ЧАСОВОГО ПОЯСА — универсальная функция (копия из notifications.tsx)
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

// ✅ ПОЛНОСТЬЮ ПЕРЕПИСАНА: надёжная логика планирования (локальное время → UTC timestamp)
async function scheduleMedicationNotification(
  name: string,
  form: string,
  time: string,
  scheduleType: Medication["schedule_type"],
  weeklyDays?: string[],
  intervalDays?: number,
  startDate?: string
) {
  const [hour, minute] = time.split(":").map(Number);
  if (isNaN(hour) || isNaN(minute)) return;

  const now = new Date();

  // Вспомогательная функция: создаёт дату с 00:00:00.000 локального времени
  const startOfDay = (d: Date): Date => {
    const clean = new Date(d);
    clean.setHours(0, 0, 0, 0);
    return clean;
  };

  if (scheduleType === "daily") {
    // === ЕЖЕДНЕВНО ===
    const today = startOfDay(now);
    const intakeTime = new Date(today);
    intakeTime.setHours(hour, minute, 0, 0);

    const notificationTime = new Date(intakeTime);
    notificationTime.setMinutes(minute - 10);

    // Если приём сегодня уже прошёл — переносим на завтра
    if (intakeTime <= now) {
      intakeTime.setDate(intakeTime.getDate() + 1);
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 ${name}`,
        body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: "#4A3AFF",
      },
      trigger: { 
        date: localDateToUtcTimestamp(notificationTime) // ✅ ФИКС
      },
    });

  } else if (scheduleType === "weekly_days" && weeklyDays) {
    // === ПО ДНЯМ НЕДЕЛИ ===
    const today = startOfDay(now);
    const currentDayIndex = now.getDay(); // 0=ВС, 1=ПН, ..., 6=СБ
    const dayIndexMap: Record<string, number> = {
      "ВС": 0, "ПН": 1, "ВТ": 2, "СР": 3, "ЧТ": 4, "ПТ": 5, "СБ": 6
    };

    for (const dayAbbr of weeklyDays) {
      const targetIndex = dayIndexMap[dayAbbr];
      if (targetIndex === undefined) continue;

      let daysToAdd = (targetIndex - currentDayIndex + 7) % 7;
      let candidateDate = new Date(today);
      candidateDate.setDate(today.getDate() + daysToAdd);

      const intakeTime = new Date(candidateDate);
      intakeTime.setHours(hour, minute, 0, 0);

      if (daysToAdd === 0 && intakeTime <= now) {
        intakeTime.setDate(intakeTime.getDate() + 7);
      }

      const notificationTime = new Date(intakeTime);
      notificationTime.setMinutes(minute - 10);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 ${name}`,
          body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: "#4A3AFF",
        },
        trigger: { 
          date: localDateToUtcTimestamp(notificationTime) // ✅ ФИКС
        },
      });
    }

  } else if (scheduleType === "every_x_days" && intervalDays && startDate) {
    // === КАЖДЫЕ X ДНЕЙ ===
    const start = startOfDay(new Date(startDate));
    const today = startOfDay(now);

    const diffMs = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    let nextOffset = ((-diffDays) % intervalDays + intervalDays) % intervalDays;
    let nextDate = new Date(today);
    nextDate.setDate(today.getDate() + nextOffset);

    const intakeTime = new Date(nextDate);
    intakeTime.setHours(hour, minute, 0, 0);

    if (nextOffset === 0 && intakeTime <= now) {
      intakeTime.setDate(intakeTime.getDate() + intervalDays);
    }

    const notificationTime = new Date(intakeTime);
    notificationTime.setMinutes(minute - 10);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 ${name}`,
        body: `Через 10 минут нужно принять ${form || "лекарство"} в ${time}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: "#4A3AFF",
      },
      trigger: { 
        date: localDateToUtcTimestamp(notificationTime) // ✅ ФИКС
      },
    });
  }
}

// 🔁 Маппинг: "ПН" → 1, "ВТ" → 2, ..., "ВС" → 7
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

// ✅ Валидация даты
const validateDate = (dateStr: string): boolean => {
  if (!dateStr) return true;
  const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  const match = dateStr.match(regex);
  if (!match) return false;

  const [, dd, mm, yyyy] = match;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);

  return (
    day >= 1 && day <= 31 &&
    month >= 1 && month <= 12 &&
    year >= 1900 && year <= 2100
  );
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
  const [endDate, setEndDate] = useState("");
  const [scheduleType, setScheduleType] = useState<Medication["schedule_type"]>("daily");
  const [timesList, setTimesList] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [intervalDays, setIntervalDays] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const startDateRef = useRef<TextInput>(null);
  const endDateRef = useRef<TextInput>(null);

  // Анимация появления при монтировании
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

  const validate = () => {
    const err: Record<string, string> = {};

    if (!name.trim()) err.name = "Обязательно";
    if (!startDate) err.startDate = "Обязательно";
    if (startDate && !validateDate(startDate)) err.startDate = "Формат: ДД.ММ.ГГГГ";
    if (endDate && !validateDate(endDate)) err.endDate = "Формат: ДД.ММ.ГГГГ";

    const times = timesList.split(",").map(t => t.trim());
    for (const t of times) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(t)) {
        err.times = `Неверное время: ${t}`;
        break;
      }
    }

    if (scheduleType === "every_x_days") {
      const num = parseInt(intervalDays);
      if (!intervalDays || isNaN(num) || num < 1 || num > 30) {
        err.interval = "1–30 дней";
      }
    }

    if (scheduleType === "weekly_days" && selectedDays.length === 0) {
      err.weekly = "Выберите дни";
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleAdd = useCallback(async () => {
    if (!validate()) return;

    LayoutAnimation.configureNext({
      duration: 150,
      create: { type: LayoutAnimation.Types.easeInEaseOut },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });

    Keyboard.dismiss();

    const convertDate = (dateStr: string): string | null => {
      if (!dateStr) return null;
      const [dd, mm, yyyy] = dateStr.split(".").map(Number);
      return `${yyyy}-${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
    };

    const originalStartDate = convertDate(startDate)!;

    // ✅ Дата на 1 день РАНЬШЕ — для сохранения в БД и на сервере
    const startDateMinus1d = (() => {
      const d = new Date(originalStartDate);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
    })();

    const isoEndDate = convertDate(endDate);

    const med: Medication = {
      name,
      form,
      instructions: instructions || null,
      start_date: startDateMinus1d, // ← ← ← день назад в БД
      end_date: isoEndDate,
      schedule_type: scheduleType,
      weekly_days: scheduleType === "weekly_days" ? selectedDays : null,
      interval_days: scheduleType === "every_x_days" ? parseInt(intervalDays) : null,
      times_list: timesList.split(",").map(t => t.trim()),
    };

    try {
      const localId = await addMedication(med);
      console.log("✅ Лекарство сохранено локально, id:", localId);

      // ✅ Планируем уведомления — по ОРИГИНАЛЬНОЙ дате!
      for (const time of med.times_list) {
        await scheduleMedicationNotification(
          med.name,
          med.form,
          time,
          med.schedule_type,
          med.weekly_days,
          med.interval_days,
          originalStartDate // ← ← ← оригинальная дата!
        );
      }

      // Отправка на сервер
      try {
        const user = await getLocalUser();
        if (!user) throw new Error("Пользователь не авторизован");

        const serverPayload = {
          name: med.name,
          form: med.form,
          instructions: med.instructions,
          start_date: med.start_date, // ← ← ← startDateMinus1d
          end_date: med.end_date,
          schedule_type: med.schedule_type,
          week_days: med.schedule_type === "weekly_days"
            ? selectedDays.map(mapDayToNumber)
            : undefined,
          interval_days: med.schedule_type === "every_x_days"
            ? med.interval_days
            : undefined,
          times_per_day: med.times_list.map(formatTimeForServer),
        };

        const serverResponse = await apiClient.postWithAuth(
          "/medicines/add_medication",
          serverPayload
        );

        if (serverResponse.id) {
          await updateMedicationServerId(localId, serverResponse.id);
        }

        setSnackbarMessage('✅ Лекарство добавлено и синхронизировано!');
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
      setSnackbarMessage(e.message || 'Не удалось добавить лекарство');
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
          onPress={() => setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
          )}
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
              error={!!errors.name}
              style={{ marginBottom: 16 }}
              icon="pill"
              autoFocus
            />
            {errors.name && <HelperText type="error">{errors.name}</HelperText>}

            <Menu
              visible={formVisible}
              onDismiss={() => setFormVisible(false)}
              anchor={
                <AnimatedTextInput
                  label="Форма"
                  value={form === "tablet" ? "Таблетка" : form === "drop" ? "Капли" : "Спрей"}
                  mode="outlined"
                  editable={false}
                  onPress={() => setFormVisible(true)}
                  error={!!errors.form}
                  style={{ marginBottom: 16 }}
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

            <AnimatedTextInput
              ref={startDateRef}
              label="Дата начала (ДД.ММ.ГГГГ)"
              value={startDate}
              onChangeText={(text) => setStartDate(formatDateString(text))}
              keyboardType="numeric"
              maxLength={10}
              mode="outlined"
              error={!!errors.startDate}
              style={{ marginBottom: 16 }}
              icon="calendar-start"
              onSubmitEditing={() => endDateRef.current?.focus()}
            />
            {errors.startDate && <HelperText type="error">{errors.startDate}</HelperText>}

            <AnimatedTextInput
              ref={endDateRef}
              label="Дата окончания (необязательно)"
              value={endDate}
              onChangeText={(text) => setEndDate(formatDateString(text))}
              keyboardType="numeric"
              maxLength={10}
              mode="outlined"
              error={!!errors.endDate}
              style={{ marginBottom: 16 }}
              icon="calendar-end"
            />
            {errors.endDate && <HelperText type="error">{errors.endDate}</HelperText>}

            <Menu
              visible={scheduleVisible}
              onDismiss={() => setScheduleVisible(false)}
              anchor={
                <AnimatedTextInput
                  label="Расписание"
                  value={
                    scheduleType === "daily" ? "Ежедневно" :
                    scheduleType === "weekly_days" ? "По дням недели" : "Каждые X дней"
                  }
                  mode="outlined"
                  editable={false}
                  onPress={() => setScheduleVisible(true)}
                  error={!!errors.schedule}
                  style={{ marginBottom: 16 }}
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

            {scheduleType === "every_x_days" && (
              <>
                <AnimatedTextInput
                  label="Интервал (дней)"
                  value={intervalDays}
                  onChangeText={setIntervalDays}
                  keyboardType="numeric"
                  mode="outlined"
                  error={!!errors.interval}
                  style={{ marginBottom: 16 }}
                  icon="numeric"
                />
                {errors.interval && <HelperText type="error">{errors.interval}</HelperText>}
              </>
            )}

            {scheduleType === "weekly_days" && (
              <View style={{ 
                flexDirection: "row", 
                justifyContent: "space-between", 
                marginBottom: 20,
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

            <AnimatedTextInput
              label="Время приёма (08:00, 20:00)"
              value={timesList}
              onChangeText={setTimesList}
              mode="outlined"
              error={!!errors.times}
              style={{ marginBottom: 20 }}
              icon="clock-time-four-outline"
              multiline
            />
            {errors.times && <HelperText type="error">{errors.times}</HelperText>}

            <AnimatedTextInput
              label="Инструкции"
              value={instructions}
              onChangeText={setInstructions}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={{ marginBottom: 28 }}
              icon="note-text-outline"
            />

            <Animated.View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                onPress={handleAdd}
                activeOpacity={0.8}
                disabled={Object.keys(errors).length > 0}
              >
                <Animated.View
                  style={{
                    backgroundColor: Object.keys(errors).length > 0 ? '#323232' : '#4A3AFF',
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