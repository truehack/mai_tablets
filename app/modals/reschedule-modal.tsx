import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Alert, TouchableOpacity, Keyboard, ScrollView } from 'react-native';
import { Card, Button, Portal, Modal, Provider, Surface, Icon, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/hooks/use-database';

export default function RescheduleModal() {
  const { medicationId, plannedTime } = useLocalSearchParams();
  const router = useRouter();
  const { getMedications, getIntakeHistory, addIntake } = useDatabase();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState('');
  const [medication, setMedication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Правильное объявление ref-ов
  const monthInput = useRef(null);
  const yearInput = useRef(null);
  const hoursInput = useRef(null);
  const minutesInput = useRef(null);

  useEffect(() => {
    const loadMed = async () => {
      try {
        setLoading(true);
        const meds = await getMedications();
        const found = meds.find(m => m.id === Number(medicationId));
        if (found) {
          setMedication(found);
        }
      } catch (error) {
        console.error('Ошибка загрузки лекарства:', error);
        setError('Не удалось загрузить информацию о лекарстве');
      } finally {
        setLoading(false);
      }
    };
    loadMed();
  }, [medicationId]);

  // Валидация отдельных полей
  const validateDay = (value: string): boolean => {
    if (!value) return false;
    const dayNum = parseInt(value);
    return dayNum >= 1 && dayNum <= 31;
  };

  const validateMonth = (value: string): boolean => {
    if (!value) return false;
    const monthNum = parseInt(value);
    return monthNum >= 1 && monthNum <= 12;
  };

  const validateYear = (value: string): boolean => {
    if (!value) return false;
    const yearNum = parseInt(value);
    const currentYear = new Date().getFullYear();
    return yearNum >= currentYear && yearNum <= currentYear + 10;
  };

  const validateHours = (value: string): boolean => {
    if (!value) return false;
    const hourNum = parseInt(value);
    return hourNum >= 0 && hourNum <= 23;
  };

  const validateMinutes = (value: string): boolean => {
    if (!value) return false;
    const minuteNum = parseInt(value);
    return minuteNum >= 0 && minuteNum <= 59;
  };

  const validateAllFields = (): boolean => {
    let isValid = true;
    let errorMsg = '';
    
    if (!validateDay(day)) {
      errorMsg += 'День должен быть от 01 до 31.\n';
      isValid = false;
    }
    if (!validateMonth(month)) {
      errorMsg += 'Месяц должен быть от 01 до 12.\n';
      isValid = false;
    }
    if (!validateYear(year)) {
      errorMsg += 'Год должен быть текущим или будущим.\n';
      isValid = false;
    }
    if (!validateHours(hours)) {
      errorMsg += 'Часы должны быть от 00 до 23.\n';
      isValid = false;
    }
    if (!validateMinutes(minutes)) {
      errorMsg += 'Минуты должны быть от 00 до 59.';
      isValid = false;
    }
    
    if (!isValid) {
      setError(errorMsg);
    } else {
      setError('');
    }
    
    return isValid;
  };

  const handleConfirm = async () => {
    // Скрываем клавиатуру перед обработкой
    Keyboard.dismiss();
    
    if (!validateAllFields()) {
      return;
    }

    try {
      // Форматируем дату и время
      const formattedDate = `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
      const formattedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      const formattedDateTime = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00.000Z`;
      
      // 1. Создаем запись о переносе в текущем времени
      await addIntake({
        medication_id: Number(medicationId),
        planned_time: plannedTime as string,
        datetime: new Date().toISOString(),
        taken: false,
        skipped: false,
        notes: `перенесен на ${formattedDate} ${formattedTime}`
      });
      
      // 2. Создаем новую запись с новым временем
      await addIntake({
        medication_id: Number(medicationId),
        planned_time: formattedTime,
        datetime: formattedDateTime,
        taken: false,
        skipped: false,
        notes: `перенос из ${plannedTime}`
      });

      // 3. Показываем подтверждение
      Alert.alert(
        'Перенос подтвержден',
        `Прием перенесен на ${formattedDate} в ${formattedTime}`,
        [{ text: 'ОК', onPress: () => router.back() }]
      );
      
    } catch (error) {
      console.error('Ошибка при переносе приема:', error);
      setError('Не удалось перенести прием');
    }
  };

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    keyboardType: "default" | "numeric" | "email-address" | "phone-pad" = 'numeric',
    maxLength: number = 2,
    placeholder?: string
  ) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{
          backgroundColor: '#2C2C2C',
          color: 'white',
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: error ? '#FF3B30' : '#333',
        }}
        placeholder={placeholder || ''}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
        placeholderTextColor="#666"
        returnKeyType="next"
      />
    </View>
  );

  if (loading) {
    return (
      <Provider>
        <Portal>
          <Modal visible={true} onDismiss={router.back}>
            <Card style={{ margin: 20, backgroundColor: '#1E1E1E' }}>
              <Card.Content>
                <Text style={{ color: 'white', textAlign: 'center' }}>Загрузка...</Text>
              </Card.Content>
            </Card>
          </Modal>
        </Portal>
      </Provider>
    );
  }

  return (
    <Provider>
      <Portal>
        <Modal visible={true} onDismiss={() => {
          Keyboard.dismiss();
          router.back();
        }}>
          <Surface style={{
            margin: 20,
            backgroundColor: '#1E1E1E',
            borderRadius: 16,
            padding: 24,
            elevation: 4,
            width: '90%',
            maxWidth: 400,
            alignSelf: 'center'
          }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ marginBottom: 20 }}>
                <Text style={{ 
                  color: 'white', 
                  fontSize: 20, 
                  fontWeight: '600', 
                  textAlign: 'center',
                  marginBottom: 16
                }}>
                  Перенос приема
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Icon source="clock-outline" size={18} color="#aaa" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#ccc', fontSize: 14 }}>
                    Текущее время: {plannedTime}
                  </Text>
                </View>
                
                <Text style={{ 
                  color: '#ccc', 
                  fontSize: 16, 
                  fontWeight: '600', 
                  marginTop: 16,
                  marginBottom: 8
                }}>
                  Новая дата
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>День</Text>
                    <TextInput
                      style={{
                        backgroundColor: '#2C2C2C',
                        color: 'white',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: error ? '#FF3B30' : '#333',
                      }}
                      placeholder="01-31"
                      value={day}
                      onChangeText={setDay}
                      keyboardType="numeric"
                      maxLength={2}
                      placeholderTextColor="#666"
                      returnKeyType="next"
                      onSubmitEditing={() => monthInput.current?.focus()}
                      ref={monthInput}
                    />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 4 }}>
                    <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>Месяц</Text>
                    <TextInput
                      style={{
                        backgroundColor: '#2C2C2C',
                        color: 'white',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: error ? '#FF3B30' : '#333',
                      }}
                      placeholder="01-12"
                      value={month}
                      onChangeText={setMonth}
                      keyboardType="numeric"
                      maxLength={2}
                      placeholderTextColor="#666"
                      returnKeyType="next"
                      onSubmitEditing={() => yearInput.current?.focus()}
                      ref={yearInput}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>Год</Text>
                    <TextInput
                      style={{
                        backgroundColor: '#2C2C2C',
                        color: 'white',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: error ? '#FF3B30' : '#333',
                      }}
                      placeholder="2023"
                      value={year}
                      onChangeText={setYear}
                      keyboardType="numeric"
                      maxLength={4}
                      placeholderTextColor="#666"
                      returnKeyType="next"
                      onSubmitEditing={() => hoursInput.current?.focus()}
                      ref={hoursInput}
                    />
                  </View>
                </View>
                
                <Text style={{ 
                  color: '#ccc', 
                  fontSize: 16, 
                  fontWeight: '600', 
                  marginTop: 16,
                  marginBottom: 8
                }}>
                  Новое время
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>Часы</Text>
                    <TextInput
                      style={{
                        backgroundColor: '#2C2C2C',
                        color: 'white',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: error ? '#FF3B30' : '#333',
                      }}
                      placeholder="00-23"
                      value={hours}
                      onChangeText={setHours}
                      keyboardType="numeric"
                      maxLength={2}
                      placeholderTextColor="#666"
                      returnKeyType="next"
                      onSubmitEditing={() => minutesInput.current?.focus()}
                      ref={minutesInput}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 4 }}>Минуты</Text>
                    <TextInput
                      style={{
                        backgroundColor: '#2C2C2C',
                        color: 'white',
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: error ? '#FF3B30' : '#333',
                      }}
                      placeholder="00-59"
                      value={minutes}
                      onChangeText={setMinutes}
                      keyboardType="numeric"
                      maxLength={2}
                      placeholderTextColor="#666"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                  </View>
                </View>
                
                {error ? <Text style={{ color: '#FF3B30', fontSize: 14, marginBottom: 16 }}>{error}</Text> : null}
                
                <Divider style={{ backgroundColor: '#333', marginVertical: 12 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      Keyboard.dismiss();
                      router.back();
                    }}
                    style={{ flex: 1, marginRight: 8 }}
                    textColor="white"
                    borderColor="#555"
                  >
                    Отмена
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleConfirm}
                    style={{ flex: 1, marginLeft: 8 }}
                    buttonColor="#4A3AFF"
                    textColor="white"
                  >
                    Подтвердить
                  </Button>
                </View>
              </View>
            </ScrollView>
          </Surface>
        </Modal>
      </Portal>
    </Provider>
  );
}