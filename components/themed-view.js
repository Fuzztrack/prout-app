"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemedView = void 0;
const react_native_1 = require("react-native");
const use_theme_color_1 = require("@/hooks/use-theme-color");
function ThemedView({ style, lightColor, darkColor, ...otherProps }) {
    const backgroundColor = (0, use_theme_color_1.useThemeColor)({ light: lightColor, dark: darkColor }, 'background');
    return <react_native_1.View style={[{ backgroundColor }, style]} {...otherProps}/>;
}
exports.ThemedView = ThemedView;
