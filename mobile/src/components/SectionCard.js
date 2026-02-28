import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useAppTheme} from '../theme';

export default function SectionCard({title, children}) {
  const {palette} = useAppTheme();
  const styles = React.useMemo(() => createStyles(palette), [palette]);

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

function createStyles(palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.colors.card,
      borderRadius: palette.radius.lg,
      borderWidth: 1,
      borderColor: palette.colors.border,
      padding: 16,
      gap: 12,
    },
    title: {
      color: palette.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
