import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import i18n from '../lib/i18n';

const SCREEN_WIDTH = Dimensions.get('window').width;

const TUTORIAL_DATA = [
  {
    id: '1',
    title: i18n.t('tuto_notif_title'),
    description: i18n.t('tuto_notif_desc'),
    icon: 'notifications-outline',
    color: '#9C27B0',
  },
  {
    id: '2',
    title: i18n.t('tuto_sound_title'),
    description: i18n.t('tuto_sound_desc'),
    icon: 'volume-high-outline',
    color: '#F4A261',
  },
  {
    id: '3',
    title: i18n.t('tuto_1_title'),
    description: i18n.t('tuto_1_desc'),
    icon: 'paper-plane-outline',
    color: '#4CAF50',
  },
  {
    id: '4',
    title: i18n.t('tuto_2_title'),
    description: i18n.t('tuto_2_desc'),
    icon: 'chatbubble-ellipses-outline',
    color: '#2196F3',
  },
  {
    id: '5',
    title: i18n.t('tuto_3_title'),
    description: i18n.t('tuto_3_desc'),
    icon: 'moon-outline',
    color: '#9C27B0',
  },
  {
    id: '6',
    title: i18n.t('tuto_4_title'),
    description: i18n.t('tuto_4_desc'),
    icon: 'volume-mute-outline',
    color: '#FF9800',
  },
];

export function TutorialSwiper({ onClose }: { onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (SCREEN_WIDTH - 40)); // 40 = padding horizontal du container parent
    setCurrentIndex(index);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{i18n.t('tuto_header')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#604a3e" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={TUTORIAL_DATA}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon as any} size={48} color="white" />
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      <View style={styles.pagination}>
        {TUTORIAL_DATA.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index === currentIndex ? '#604a3e' : '#d9c0b2' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#604a3e',
  },
  closeButton: {
    padding: 5,
  },
  slide: {
    width: SCREEN_WIDTH - 80, // Largeur de la slide (container width - padding)
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
});

