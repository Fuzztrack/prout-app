"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemedText = void 0;
const react_native_1 = require("react-native");
const use_theme_color_1 = require("@/hooks/use-theme-color");
function ThemedText({ style, lightColor, darkColor, type = 'default', ...rest }) {
    const color = (0, use_theme_color_1.useThemeColor)({ light: lightColor, dark: darkColor }, 'text');
    return (<react_native_1.Text style={[
            { color },
            type === 'default' ? styles.default : undefined,
            type === 'title' ? styles.title : undefined,
            type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
            type === 'subtitle' ? styles.subtitle : undefined,
            type === 'link' ? styles.link : undefined,
            style,
        ]} {...rest}/>);
}
exports.ThemedText = ThemedText;
const styles = react_native_1.StyleSheet.create({
    default: {
        fontSize: 16,
        lineHeight: 24,
    },
    defaultSemiBold: {
        fontSize: 16,
        lineHeight: 24,
        fontWeight: '600',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 32,
    },
    subtitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    link: {
        lineHeight: 30,
        fontSize: 16,
        color: '#0a7ea4',
    },
});
