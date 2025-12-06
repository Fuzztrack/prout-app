"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_reanimated_1 = __importStar(require("react-native-reanimated"));
const themed_view_1 = require("@/components/themed-view");
const use_color_scheme_1 = require("@/hooks/use-color-scheme");
const use_theme_color_1 = require("@/hooks/use-theme-color");
const HEADER_HEIGHT = 250;
function ParallaxScrollView({ children, headerImage, headerBackgroundColor, }) {
    const backgroundColor = (0, use_theme_color_1.useThemeColor)({}, 'background');
    const colorScheme = (0, use_color_scheme_1.useColorScheme)() ?? 'light';
    const scrollRef = (0, react_native_reanimated_1.useAnimatedRef)();
    const scrollOffset = (0, react_native_reanimated_1.useScrollOffset)(scrollRef);
    const headerAnimatedStyle = (0, react_native_reanimated_1.useAnimatedStyle)(() => {
        return {
            transform: [
                {
                    translateY: (0, react_native_reanimated_1.interpolate)(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]),
                },
                {
                    scale: (0, react_native_reanimated_1.interpolate)(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
                },
            ],
        };
    });
    return (<react_native_reanimated_1.default.ScrollView ref={scrollRef} style={{ backgroundColor, flex: 1 }} scrollEventThrottle={16}>
      <react_native_reanimated_1.default.View style={[
            styles.header,
            { backgroundColor: headerBackgroundColor[colorScheme] },
            headerAnimatedStyle,
        ]}>
        {headerImage}
      </react_native_reanimated_1.default.View>
      <themed_view_1.ThemedView style={styles.content}>{children}</themed_view_1.ThemedView>
    </react_native_reanimated_1.default.ScrollView>);
}
exports.default = ParallaxScrollView;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: HEADER_HEIGHT,
        overflow: 'hidden',
    },
    content: {
        flex: 1,
        padding: 32,
        gap: 16,
        overflow: 'hidden',
    },
});
