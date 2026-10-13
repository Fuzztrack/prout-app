import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SearchUser } from '../components/SearchUser';

export default function SearchUserScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SearchUser visible={true} onClose={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ebb89b',
  },
});
