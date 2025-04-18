import React, {
  forwardRef,
  Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SWIPE_DIRECTION, SwipePan } from './SwipePan';
import { CardWrap } from './CardWrap';

const { width } = Dimensions.get('window');

interface CardsSwipeProps {
  cards: Array<any>;
  renderCard: (card: any) => React.ReactNode;
  loop?: boolean;
  renderNoMoreCard?: () => React.ReactNode;
  renderYep?: () => React.ReactNode;
  renderNope?: () => React.ReactNode;
  initialIndex?: number;
  containerStyle?: StyleProp<ViewStyle>;
  cardContainerStyle?: StyleProp<ViewStyle>;
  lowerCardZoom?: number;
  animDuration?: number;
  horizontalThreshold?: number;
  rotationAngle?: number;
  onSwipeStart?: (index: number) => void;
  onSwipeChangeDirection?: (direction: SWIPE_DIRECTION) => void;
  onSwipeEnd?: (index: number) => void;
  onSwiped?: (index: number) => void;
  onSwipedLeft?: (index: number) => void;
  onSwipedRight?: (index: number) => Promise<boolean>;
  onNoMoreCards?: () => void;
  keyExtractor?: (index: number) => string;
}

export interface CardsSwipeRefObject {
  swipeLeft: () => void;
  swipeRight: () => void;
  setPrevIndex: () => void;
  toggleLock: (value: boolean) => void;
}

let uniqueIndex = 0;
export const CardsSwipe = forwardRef(
  (
    {
      cards,
      renderCard,
      loop = true,
      renderNoMoreCard = () => null,
      renderYep = () => null,
      renderNope = () => null,
      initialIndex = 0,
      containerStyle = {},
      cardContainerStyle = {},
      lowerCardZoom = 0.95,
      animDuration = 150,
      horizontalThreshold = width * 0.65,
      rotationAngle = 10,
      onSwipeStart = () => {},
      onSwipeChangeDirection = () => {},
      onSwipeEnd = () => {},
      onSwipedLeft = () => {},
      onSwipedRight = () => Promise.resolve(true),
      onNoMoreCards = () => {},
      keyExtractor,
    }: CardsSwipeProps,
    ref: Ref<CardsSwipeRefObject>
  ) => {
    const [index, setIndex] = useState(initialIndex);
    const [lock, setLock] = useState(false);
    const [noMoreCards, setNoMoreCards] = useState(false);
    const scale = useSharedValue(1);
    const overrideNopeOpacity = useSharedValue(0);
    const overrideLikeOpacity = useSharedValue(0);

    const [secondIndex, setSecondIndex] = useState(index + 1);

    useImperativeHandle(ref, () => ({
      swipeLeft,
      swipeRight,
      toggleLock: setLock,
      setPrevIndex: () => {
        setTimeout(() => {
          setIndex((prev) => {
            setSecondIndex(prev);
            return prev - 1;
          });
        }, 400);
      },
    }));

    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const originY = useSharedValue(0);

    const prevCards = useRef(cards);
    useEffect(() => {
      if (prevCards.current !== cards) {
        prevCards.current = cards;
        if (noMoreCards) {
          setIndex(0);
          setSecondIndex(1);
          setNoMoreCards(false);
          x.value = 0;
          y.value = 0;
        }
      } else if (cards.length === 0) {
        setNoMoreCards(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cards]);

    useEffect(() => {
      if (noMoreCards) {
        onNoMoreCards();
      }
    }, [noMoreCards, onNoMoreCards]);

    const swipeLeft = () => {
      if (index >= 0) {
        overrideNopeOpacity.value = withSpring(1);
        setTimeout(() => onCardSwiped(false), 300);
      }
    };

    const swipeRight = () => {
      if (index >= 0) {
        overrideLikeOpacity.value = withSpring(1);
        setTimeout(() => onCardSwiped(true), 300);
      }
    };

    const onStartSwipe = useCallback(() => {
      onSwipeStart(index);
    }, [index, onSwipeStart]);

    const onChangeSwipeDirection = useCallback(
      (direction: SWIPE_DIRECTION) => {
        onSwipeChangeDirection(direction);
      },
      [onSwipeChangeDirection]
    );

    const onCardSwiped = useCallback(
      async (right: boolean) => {
        setLock(true);

        const onEndCardAnimation = () => {
          const resetPosition = (secondCardIndex: number) => {
            x.value = withDelay(
              100,
              withTiming(0, { duration: 0 }, () => {
                runOnJS(setSecondIndex)(secondCardIndex);
              })
            );
            y.value = withDelay(100, withTiming(0, { duration: 0 }));
          };
          if (loop || index + 2 < cards.length) {
            const incSafe = (i: number) => (i + 1) % cards.length;
            setIndex(incSafe(index));
            resetPosition(incSafe(secondIndex));
          } else if (index + 1 < cards.length) {
            setIndex(index + 1);
            resetPosition(-1);
          } else {
            setIndex(-1);
            setNoMoreCards(true);
          }
          overrideNopeOpacity.value = 0;
          overrideLikeOpacity.value = 0;

          setLock(false);
        };

        if (right) {
          if (await onSwipedRight(index)) {
            x.value = withTiming(
              width * 1.5,
              { duration: animDuration },
              () => {
                runOnJS(onEndCardAnimation)();
              }
            );
          } else {
            x.value = withSpring(0);
            y.value = withSpring(0);
            overrideNopeOpacity.value = 0;
            overrideLikeOpacity.value = 0;
            runOnJS(setLock)(false);
          }
          //onSwipedRight(index);
        } else {
          onSwipedLeft(index);
          x.value = withTiming(-width * 1.5, { duration: animDuration }, () => {
            runOnJS(onEndCardAnimation)();
          });
          y.value = withSpring(0);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [index, secondIndex, cards, onSwipedRight, onSwipedLeft]
    );

    const renderNoMoreCardsContainer = () => {
      if (noMoreCards) {
        return renderNoMoreCard();
      }
      return null;
    };

    const nopeOpacityStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        x.value,
        [-(horizontalThreshold / 2), (-horizontalThreshold * 3) / 4],
        [0, 1]
      );

      return {
        opacity: overrideNopeOpacity.value || opacity,
      };
    });

    const likeOpacityStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        x.value,
        [horizontalThreshold / 2, (horizontalThreshold * 3) / 4],
        [0, 1]
      );

      return {
        opacity: overrideLikeOpacity.value || opacity,
      };
    });

    const style = useAnimatedStyle(() => {
      const factor = 1;

      const rotateZ = interpolate(
        x.value,
        [0, factor * horizontalThreshold],
        [0, rotationAngle]
      );

      return {
        elevation: 2,
        width: '100%',
        height: '100%',
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [
          { scale: scale.value },
          { translateX: x.value },
          { translateY: y.value },
          { rotateZ: `${rotateZ}deg` },
        ],
      };
    });

    const lowerStyle = useAnimatedStyle(() => {
      const lowerCardScale = interpolate(
        x.value,
        [-horizontalThreshold, -0.01, 0, 0.01, horizontalThreshold],
        [1, lowerCardZoom, lowerCardZoom, lowerCardZoom, 1],
        Extrapolation.CLAMP
      );

      return {
        width: '100%',
        height: '100%',
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { scale: secondIndex >= 0 ? lowerCardScale : 1 },
        ],
      };
    });

    return (
      <View
        pointerEvents={lock ? 'none' : 'auto'}
        style={[styles.container, containerStyle]}
      >
        {cards.length > 0 && (
          <>
            {/* render under card */}
            {secondIndex >= 0 && cards.length > secondIndex && (
              <CardWrap
                key={keyExtractor?.(secondIndex) ?? ++uniqueIndex}
                style={[index === secondIndex ? {} : lowerStyle, { zIndex: 1 }]}
                cardContainerStyle={cardContainerStyle}
                children={renderCard(cards[secondIndex])}
              />
            )}
            {/* render visible card */}
            {index >= 0 && index !== secondIndex && (
              <SwipePan
                key={keyExtractor?.(index) ?? ++uniqueIndex}
                onSnap={onCardSwiped}
                onStart={onStartSwipe}
                onChangeDirection={onChangeSwipeDirection}
                x={x}
                y={y}
                originY={originY}
              >
                <CardWrap
                  style={style}
                  cardContainerStyle={[
                    cardContainerStyle,
                    { zIndex: 2, elevation: 2 },
                  ]}
                >
                  {renderCard(cards[index])}
                  <Animated.View style={styles.overlay} pointerEvents={'none'}>
                    <View style={styles.row}>
                      <Animated.View
                        style={likeOpacityStyle}
                        children={renderYep()}
                      />
                      <Animated.View
                        style={nopeOpacityStyle}
                        children={renderNope()}
                      />
                    </View>
                  </Animated.View>
                </CardWrap>
              </SwipePan>
            )}
          </>
        )}
        {renderNoMoreCardsContainer()}
      </View>
    );
  }
);
CardsSwipe.displayName = 'CardsSwipe';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 100,
    elevation: 100,
    justifyContent: 'space-between',
  },
});
