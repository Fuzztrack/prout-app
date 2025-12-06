"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collapsible = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
const themed_text_1 = require("@/components/themed-text");
const themed_view_1 = require("@/components/themed-view");
const icon_symbol_1 = require("@/components/ui/icon-symbol");
const theme_1 = require("@/constants/theme");
const use_color_scheme_1 = require("@/hooks/use-color-scheme");
function Collapsible({ children, title }) {
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const theme = (0, use_color_scheme_1.useColorScheme)() ?? 'light';
    return (<themed_view_1.ThemedView>
      <react_native_1.TouchableOpacity style={styles.heading} onPress={() => setIsOpen((value) => !value)} activeOpacity={0.8}>
        <icon_symbol_1.IconSymbol name="chevron.right" size={18} weight="medium" color={theme === 'light' ? theme_1.Colors.light.icon : theme_1.Colors.dark.icon} style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}/>

        <themed_text_1.ThemedText type="defaultSemiBold">{title}</themed_text_1.ThemedText>
      </react_native_1.TouchableOpacity>
      {isOpen && <themed_view_1.ThemedView style={styles.content}>{children}</themed_view_1.ThemedView>}
    </themed_view_1.ThemedView>);
}
exports.Collapsible = Collapsible;
const styles = react_native_1.StyleSheet.create({
    heading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    content: {
        marginTop: 6,
        marginLeft: 24,
    },
});
