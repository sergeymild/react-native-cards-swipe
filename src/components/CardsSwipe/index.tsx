import React, {forwardRef, Ref, useCallback, useEffect, useImperativeHandle, useRef, useState,} from 'react';
import {Dimensions, StyleProp, View, ViewStyle} from 'react-native';
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

import SwipePan, {SWIPE_DIRECTION} from '../SwipePan';
import CardWrap from '../CardWrap';

import styles from './styles';

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
  keyExtractor?: (index: number) => string
}

export interface CardsSwipeRefObject {
  swipeLeft: () => void;
  swipeRight: () => void;
  setPrevIndex: () => void;
  toggleLock: (value: boolean) => void
}

let uniqueIndex = 0
const CardsSwipe = forwardRef(
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
      keyExtractor
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
            setSecondIndex(prev)
            return prev - 1
          })
        }, 400)
      } }));

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
        setNoMoreCards(true)
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
            x.value = withTiming(width * 1.5, { duration: animDuration }, () => {
              runOnJS(onEndCardAnimation)()
            });
          } else {
            x.value = withSpring(0);
            y.value = withSpring(0);
            overrideNopeOpacity.value = 0;
            overrideLikeOpacity.value = 0;
            runOnJS(setLock)(false)
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
      const opacity = interpolate(x.value, [-(horizontalThreshold / 2), -horizontalThreshold * 3/4], [0, 1]);

      return {
        opacity: overrideNopeOpacity.value || opacity,
      };
    });

    const likeOpacityStyle = useAnimatedStyle(() => {
      const opacity = interpolate(x.value, [horizontalThreshold / 2, horizontalThreshold * 3/4], [0, 1]);

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
        zIndex: -1,
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

    console.log('🍓[Index.render]', index, secondIndex)


    return (
      <View
        pointerEvents={lock ? 'none' : 'auto'}
        style={[styles.container, containerStyle]}
      >
        {cards.length > 0 && <>
          {secondIndex >= 0 && cards.length > secondIndex ? (
            <CardWrap
              {...{
                key: keyExtractor?.(secondIndex) ?? ++uniqueIndex,
                pointerEvents: 'none',
                style: index === secondIndex ? {} : lowerStyle,
                cardContainerStyle,
              }}
            >
              {renderCard(cards[secondIndex])}
            </CardWrap>
          ) : null}
          {index >= 0  && index !== secondIndex ? (
            <SwipePan
              key={keyExtractor?.(index) ?? ++uniqueIndex}
              {...{
                onSnap: onCardSwiped,
                onStart: onStartSwipe,
                onChangeDirection: onChangeSwipeDirection,
                x,
                y,
                originY,
              }}
            >
              <CardWrap
                {...{
                  style,
                  cardContainerStyle,
                }}
              >
                {renderCard(cards[index])}
                <Animated.View style={styles.overlay} pointerEvents={'none'}>
                  <View style={styles.row}>
                    <Animated.View style={likeOpacityStyle}>
                      {renderYep()}
                    </Animated.View>
                    <Animated.View style={nopeOpacityStyle}>
                      {renderNope()}
                    </Animated.View>
                  </View>
                </Animated.View>
              </CardWrap>
            </SwipePan>
          ) : null}
        </>}
        {renderNoMoreCardsContainer()}
      </View>
    );
  }
);

export default CardsSwipe;
