import * as React from 'react';
import { Dimensions } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import {
  useAnimatedGestureHandler,
  withSpring,
  runOnJS,
  useSharedValue,
} from 'react-native-reanimated';

export enum SWIPE_DIRECTION {
  LEFT = 'left',
  RIGHT = 'right',
  DEFAULT = 'default',
}

interface Value {
  value: number;
}

interface Props {
  x: Value;
  y: Value;
  originY: Value;
  onSnap: (swipedRight: boolean) => void;
  onStart: () => void;
  onChangeDirection: (direction: SWIPE_DIRECTION) => void;
  children: React.ReactNode;
}

type AnimatedGHContext = {
  startX: number;
  startY: number;
};

const { width } = Dimensions.get('window');

export const SwipePan = ({
  x,
  y,
  onSnap,
  onStart,
  onChangeDirection,
  originY,
  children,
}: Props) => {
  const directionX = useSharedValue(SWIPE_DIRECTION.DEFAULT);
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (event, ctx: AnimatedGHContext) => {
      ctx.startX = x.value;
      ctx.startY = y.value;

      originY.value = event.y;
      runOnJS(onStart)();
    },
    onActive: (event, ctx) => {
      x.value = ctx.startX + event.translationX;
      y.value = ctx.startY + event.translationY;
      const direction =
        Math.round(x.value) > 0 ? SWIPE_DIRECTION.RIGHT : SWIPE_DIRECTION.LEFT;
      if (direction !== directionX.value) {
        directionX.value = direction;
        runOnJS(onChangeDirection)(direction);
      }
    },
    onEnd: (event, ctx) => {
      const thresh = width * 0.3;
      const diff = ctx.startX + event.translationX;
      directionX.value = SWIPE_DIRECTION.DEFAULT;
      runOnJS(onChangeDirection)(directionX.value);

      if (diff > thresh) {
        runOnJS(onSnap)(true);
      } else if (diff < -1 * thresh) {
        runOnJS(onSnap)(false);
      } else {
        x.value = withSpring(0);
        y.value = withSpring(0);
      }
    },
  });

  return (
    <PanGestureHandler
      activeOffsetY={[-100000, 100000]}
      activeOffsetX={[-20, 20]}
      onGestureEvent={gestureHandler}
    >
      {children}
    </PanGestureHandler>
  );
};
SwipePan.displayName = 'SwipePan';
