// app/components/med-friend-profile-card.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Surface } from 'react-native-paper';
import { useTheme } from 'react-native-paper';

interface MedFriendProfileCardProps {
  medFriendName: string;
  connectedSince?: Date;
  onRemove?: () => void;
}

export const MedFriendProfileCard: React.FC<MedFriendProfileCardProps> = ({
  medFriendName,
  connectedSince,
  onRemove,
}) => {
  const theme = useTheme();

  return (
    <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.primary }]}>🧑‍⚕️ Мед-друг</Text>
        {onRemove && (
          <Text style={[styles.removeBtn, { color: theme.colors.error }]} onPress={onRemove}>
            Отключить
          </Text>
        )}
      </View>

      <View style={styles.row}>
        <Text style={[styles.label, { color: theme.colors.outline }]}>Имя:</Text>
        <Text style={[styles.value, { color: theme.colors.text }]}>{medFriendName}</Text>
      </View>

      {connectedSince && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.outline }]}>С:</Text>
          <Text style={[styles.value, { color: theme.colors.text }]}>
            {connectedSince.toLocaleDateString('ru-RU')}
          </Text>
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 320,
    padding: 16,
    borderRadius: 14,
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  removeBtn: {
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
});