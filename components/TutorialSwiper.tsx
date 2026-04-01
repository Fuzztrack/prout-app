import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import i18n from '../lib/i18n';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHAT_TUTORIAL_IMAGE = Platform.OS === 'android'
  ? require('../assets/images/proothail2.png')
  : require('../assets/images/proothail2.png');

type TutorialSlide = {
  key: string;
};

export function TutorialSwiper({ onClose }: { onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const tutorialSlides = useMemo<TutorialSlide[]>(() => [
    { key: 'list-gestures' },
    { key: 'chat-details' },
    { key: 'features-search' },
  ], []);

  const slideWidth = SCREEN_WIDTH - 40;

  const handleMomentumScrollEnd = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / slideWidth);
    const clampedIndex = Math.max(0, Math.min(index, tutorialSlides.length - 1));
    setCurrentIndex(clampedIndex);
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / slideWidth);
    const clampedIndex = Math.max(0, Math.min(index, tutorialSlides.length - 1));
    setCurrentIndex(clampedIndex);
  };

  const renderFeatureRow = (icon: React.ReactNode, text: string, marginTop = 0) => (
    <View style={[styles.featureRow, marginTop > 0 && { marginTop }]}>
      {icon}
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );

  const renderCardTitle = (title: string, rightIcon?: React.ReactNode) => (
    <View style={styles.cardTitleRow}>
      <Text style={styles.cardTitleText}>{title}</Text>
      {rightIcon ? <View style={styles.cardTitleIconWrap}>{rightIcon}</View> : null}
    </View>
  );

  const renderSlideContent = (item: TutorialSlide) => {
    switch (item.key) {
      case 'list-gestures':
        return (
          <View style={styles.tutorialCard}>
            {renderCardTitle(i18n.t('tuto_list_title'))}
            {renderFeatureRow(
              <Ionicons name="arrow-forward" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_swipe')
            )}
            {renderFeatureRow(
              <Ionicons name="finger-print" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_long_press'),
              12
            )}
            {renderFeatureRow(
              <Image
                source={require('../assets/images/tap-gesture.png')}
                style={styles.tapImage}
                resizeMode="contain"
              />,
              i18n.t('friendlist_onboarding_tap'),
              12
            )}
            {renderFeatureRow(
              <Ionicons name="arrow-back" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_swipe_left_block'),
              12
            )}
          </View>
        );
      case 'features-search':
        return (
          <View style={styles.tutorialCard}>
            {renderCardTitle(
              i18n.t('tuto_menu_title'),
              <Image
                source={require('../assets/images/icon_compte.png')}
                style={styles.menuTitleIcon}
                resizeMode="contain"
              />
            )}
            {renderFeatureRow(
              <Ionicons name="moon" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_zen'),
              4
            )}
            {renderFeatureRow(
              <Ionicons name="volume-mute" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_silent_send'),
              14
            )}
            {renderFeatureRow(
              <Ionicons name="search" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_search_contacts'),
              14
            )}
            {renderFeatureRow(
              <Ionicons name="person-add-outline" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_search_pseudo'),
              14
            )}
            {renderFeatureRow(
              <Ionicons name="trophy" size={22} color="#604a3e" />,
              i18n.t('friendlist_onboarding_resonance'),
              14
            )}
          </View>
        );
      case 'chat-details':
        return (
          <View style={styles.tutorialCard}>
            {renderCardTitle(i18n.t('tuto_chat_title'))}
            {renderFeatureRow(
              <View style={styles.chatIconSlot}>
                <Image
                  source={CHAT_TUTORIAL_IMAGE}
                  style={styles.chatProothailImage}
                  resizeMode="contain"
                />
              </View>,
              i18n.t('chat_onboarding_choose_specific_sound')
            )}
            {renderFeatureRow(
              <Ionicons name="volume-mute" size={22} color="#604a3e" />,
              i18n.t('chat_onboarding_mute'),
              12
            )}
            {renderFeatureRow(
              <Ionicons name="flag-outline" size={22} color="#604a3e" />,
              i18n.t('chat_onboarding_report_conversation'),
              12
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{i18n.t('tuto_header')}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#604a3e" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.listWrapper}>
          <FlatList
            ref={flatListRef}
            data={tutorialSlides}
            keyExtractor={(item) => item.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={slideWidth}
            snapToAlignment="start"
            contentContainerStyle={styles.listContent}
            removeClippedSubviews={true}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={(data, index) => ({
              length: slideWidth,
              offset: slideWidth * index,
              index,
            })}
            renderItem={({ item }) => (
              <View style={styles.slide}>
                {renderSlideContent(item)}
              </View>
            )}
          />
        </View>

        <View style={styles.pagination}>
          {tutorialSlides.map((_, index) => (
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
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  listWrapper: {
    flex: 1,
    width: SCREEN_WIDTH - 40,
    overflow: 'hidden',
  },
  listContent: {
    paddingHorizontal: 0,
  },
  slide: {
    width: SCREEN_WIDTH - 40,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  tutorialCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 74, 62, 0.12)',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitleText: {
    color: '#604a3e',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardTitleIconWrap: {
    marginLeft: 8,
  },
  menuTitleIcon: {
    width: 24,
    height: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureText: {
    flex: 1,
    marginLeft: 12,
    color: '#604a3e',
    fontSize: 14,
    textAlign: 'left',
    fontStyle: 'italic',
    opacity: 0.88,
    lineHeight: 19,
  },
  tapImage: {
    width: 22,
    height: 22,
    marginTop: 1,
  },
  chatIconSlot: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: -4,
  },
  chatProothailImage: {
    width: 30,
    height: 30,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 30,
    paddingVertical: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
});
