import React, { forwardRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

interface Props {
  style: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  cardContainerStyle: StyleProp<ViewStyle>;
}

export const CardWrap = forwardRef(
  (
    { style, children, cardContainerStyle, ...rest }: Props,
    ref: React.LegacyRef<Animated.View> | undefined
  ) => {
    return (
      <Animated.View
        {...{ style: [style, cardContainerStyle] }}
        {...rest}
        ref={ref}
        children={children}
      />
    );
  }
);
CardWrap.displayName = 'CardWrap';
