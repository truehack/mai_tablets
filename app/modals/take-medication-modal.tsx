// app/modals/take-medication-modal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, Animated, Easing, LayoutAnimation, UIManager } from 'react-native';
import { Card, Button, Portal, Modal, Provider, Surface, Icon, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '@/hooks/use-database';
import apiClient from '@/services/api';

// Включаем LayoutAnimation для Android
if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function TakeMedicationModal() {
  const { medicationId, plannedTime } = useLocalSearchParams<{ medicationId: string; plannedTime: string }>();
  const router = useRouter();
  const { getMedications, addIntake, deleteMedication, deleteFutureIntakes } = useDatabase();
  const theme = useTheme();

  const [medication, setMedication] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionStatus, setActionStatus] = useState<{ type: 'taken' | 'skipped'; time: string } | null>(null);

  // Анимации
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const confirmScale = useRef(new Animated.Value(0)).current;
  const confirmOpacity = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Загрузка лекарства
  useEffect(() => {
    const loadMed = async () => {
      try {
        if (!medicationId) return;
        
        const meds = await getMedications();
        const found = meds.find(m => m.id === Number(medicationId));
        
        if (!found) {
          Alert.alert('Ошибка', 'Лекарство не найдено');
          router.back();
          return;
        }
        
        setMedication(found);
      } catch (error) {
        console.error('Ошибка загрузки лекарства:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить лекарство');
        router.back();
      }
    };

    loadMed();
  }, [medicationId, router]);

  // Анимация появления модалки
  useEffect(() => {
    if (medication) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(headerOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    }

    return () => {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      headerOpacity.setValue(0);
      contentOpacity.setValue(0);
    };
  }, [medication]);

  // Анимация подтверждения
  useEffect(() => {
    if (actionStatus) {
      confirmScale.setValue(0.7);
      confirmOpacity.setValue(0);
      
      Animated.parallel([
        Animated.spring(confirmScale, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(confirmOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [actionStatus]);

  const handleIntakeAction = async (taken: boolean) => {
    if (!medication) {
      Alert.alert('Ошибка', 'Лекарство не загружено');
      return;
    }

    // Вибрация кнопки
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setIsSyncing(true);

    try {
      const now = new Date();
      const formattedTime = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      const localIntakeData = {
        medication_id: medication.id,
        planned_time: plannedTime,
        datetime: now.toISOString(),
        taken,
        skipped: !taken,
      };

      const serverIntakeData = {
        medication_id: medication.server_id,
        planned_time: plannedTime,
        datetime: now.toISOString(),
        taken,
        skipped: !taken,
      };

      // 1️⃣ Сохраняем локально
      const localId = await addIntake(localIntakeData);

      // 2️⃣ Устанавливаем статус действия
      setActionStatus({ 
        type: taken ? 'taken' : 'skipped', 
        time: formattedTime 
      });

      // 3️⃣ Синхронизируем
      if (medication.server_id != null) {
        try {
          await apiClient.intakeSync(serverIntakeData);
        } catch (syncError: any) {
          console.warn('Синхронизация отложена:', syncError.message);
        }
      }

      // ✅ Закрываем через 1.5 сек
      setTimeout(() => {
        // Анимация исчезновения
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          router.back();
        });
      }, 1500);

    } catch (error: any) {
      console.error('❌ Ошибка сохранения:', error);
      setActionStatus(null);
      setIsSyncing(false);
      Alert.alert('Ошибка', error.message || 'Не удалось сохранить приём');
    }
  };

  const handleMarkAsTaken = () => handleIntakeAction(true);
  const handleMarkAsSkipped = () => handleIntakeAction(false);
  const handleCancel = () => {
    // Анимация закрытия
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.back();
    });
  };

  const handleDelete = async () => {
    if (!medication) return;

    Alert.alert(
      'Удалить лекарство?',
      `Вы уверены, что хотите удалить "${medication.name}"?`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFutureIntakes(medication.id);
              await deleteMedication(medication.id);
              
              // Анимация удаления
              Animated.timing(scaleAnim, {
                toValue: 0.8,
                duration: 200,
                useNativeDriver: true,
              }).start(() => {
                router.back();
              });
            } catch (error) {
              console.error('Ошибка удаления:', error);
              Alert.alert('Ошибка', 'Не удалось удалить лекарство');
            }
          },
        },
      ]
    );
  };

  if (!medication) {
    return (
      <Provider>
        <Portal>
          <Modal visible={true} onDismiss={handleCancel}>
            <Card style={{ 
              margin: 20, 
              backgroundColor: '#1E1E1E',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              <Card.Content style={{ alignItems: 'center', padding: 24 }}>
                <Animated.View
                  style={{
                    opacity: opacityAnim,
                    transform: [{ scale: scaleAnim }],
                  }}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: '#2D2D2D',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}>
                    <Icon source="pill" size={24} color="#64B5F6" />
                  </View>
                  <Text style={{ 
                    color: 'white', 
                    fontSize: 16,
                    fontWeight: '500',
                  }}>
                    {isSyncing ? 'Синхронизация...' : 'Загрузка...'}
                  </Text>
                </Animated.View>
              </Card.Content>
            </Card>
          </Modal>
        </Portal>
      </Provider>
    );
  }

  // Форматируем время
  const displayTime = (() => {
    try {
      if (/^\d{1,2}:\d{2}/.test(plannedTime)) {
        return plannedTime;
      }
      const d = new Date(plannedTime);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return plannedTime;
    } catch {
      return plannedTime;
    }
  })();

  return (
    <Provider>
      <Portal>
        <Modal 
          visible={true} 
          onDismiss={handleCancel}
          contentContainerStyle={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
          }}
        >
          <Animated.View
            style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
              width: '100%',
              maxWidth: 400,
            }}
          >
            <Surface 
              style={{
                margin: 20,
                backgroundColor: '#1E1E1E',
                borderRadius: 20,
                padding: 20,
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                overflow: 'hidden',
              }}
            >
              {/* Animated Header */}
              <Animated.View style={{ opacity: headerOpacity }}>
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: 20 
                }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#2D3748',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Icon source="pill" size={28} color="#63B3ED" />
                      </View>
                      <Text style={{ 
                        color: 'white', 
                        fontSize: 20, 
                        fontWeight: '700',
                        flex: 1,
                        lineHeight: 24,
                      }}>
                        {medication.name}
                      </Text>
                    </View>
                    
                    <View style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      marginTop: 10, 
                      gap: 8,
                      backgroundColor: 'rgba(100, 116, 139, 0.15)',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 10,
                    }}>
                      <Icon source="clock-outline" size={18} color="#94A3B8" />
                      <Text style={{ color: '#CBD5E1', fontSize: 15, fontWeight: '500' }}>
                        Запланировано на {displayTime}
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    onPress={handleDelete} 
                    activeOpacity={0.7}
                    disabled={isSyncing}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: isSyncing ? '#333' : '#4A3AFF',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transform: [{ scale: isSyncing ? 0.95 : 1 }],
                    }}
                  >
                    <Icon 
                      source="trash-can-outline" 
                      size={28} 
                      color="white" 
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Animated Content */}
              <Animated.View style={{ opacity: contentOpacity }}>
                {medication.instructions && (
                  <View style={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 24,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: 'rgba(99, 189, 254, 0.15)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginTop: 2,
                      }}>
                        <Icon source="information-outline" size={18} color="#60A5FA" />
                      </View>
                      <Text style={{ 
                        color: '#E2E8F0', 
                        fontSize: 15, 
                        lineHeight: 22,
                        flex: 1,
                      }}>
                        {medication.instructions}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Animated Buttons */}
                <View style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <AnimatedButton
                    onPress={handleMarkAsSkipped}
                    color="#F87171"
                    icon="close"
                    label="Пропустить"
                    disabled={isSyncing}
                    loading={isSyncing && actionStatus?.type === 'skipped'}
                  />
                  
                  <AnimatedButton
                    onPress={handleMarkAsTaken}
                    color="#34D399"
                    icon="check"
                    label="Принять"
                    disabled={isSyncing}
                    loading={isSyncing && actionStatus?.type === 'taken'}
                  />
                  
                  <AnimatedButton
                    onPress={handleCancel}
                    color="#4A3AFF"
                    icon="clock"
                    label="Отложить"
                    disabled={isSyncing}
                  />
                </View>

                {/* ✅ Animated Confirmation */}
                {actionStatus && (
                  <Animated.View
                    style={{
                      transform: [{ scale: confirmScale }],
                      opacity: confirmOpacity,
                      marginTop: 20,
                    }}
                  >
                    <View style={{ 
                      padding: 18,
                      backgroundColor: actionStatus.type === 'taken' 
                        ? 'rgba(52, 211, 153, 0.15)' 
                        : 'rgba(248, 113, 113, 0.15)',
                      borderRadius: 16,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: actionStatus.type === 'taken' 
                        ? 'rgba(52, 211, 153, 0.3)' 
                        : 'rgba(248, 113, 113, 0.3)',
                    }}>
                      <View style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: actionStatus.type === 'taken' 
                          ? 'rgba(52, 211, 153, 0.2)' 
                          : 'rgba(248, 113, 113, 0.2)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}>
                        <Icon 
                          source={actionStatus.type === 'taken' ? 'check-circle' : 'close-circle'} 
                          size={36} 
                          color={actionStatus.type === 'taken' ? '#10B981' : '#EF4444'} 
                        />
                      </View>
                      <Text style={{ 
                        color: actionStatus.type === 'taken' ? '#6EE7B7' : '#FCA5A5',
                        fontSize: 18,
                        fontWeight: '700',
                        textAlign: 'center',
                        lineHeight: 24,
                      }}>
                        {actionStatus.type === 'taken' 
                          ? `✅ Принято в ${actionStatus.time}` 
                          : `❌ Пропущено в ${actionStatus.time}`}
                      </Text>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>
            </Surface>
          </Animated.View>
        </Modal>
      </Portal>
    </Provider>
  );
}

// Компонент анимированной кнопки
const AnimatedButton = ({ 
  onPress, 
  color, 
  icon, 
  label, 
  disabled = false,
  loading = false
}: { 
  onPress: () => void; 
  color: string; 
  icon: string; 
  label: string;
  disabled?: boolean;
  loading?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 0.95,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.8}
      style={{
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: disabled ? 0 : 4,
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale }],
          opacity,
          height: 72,
          backgroundColor: disabled ? '#333' : color,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {loading ? (
          <Icon source="dots-horizontal" size={24} color="white" />
        ) : (
          <>
            <Icon source={icon} size={28} color="white" />
            <Text style={{ 
              color: 'white', 
              fontSize: 13, 
              fontWeight: '600',
              marginTop: 6,
              textAlign: 'center',
            }}>
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};